"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "../lib/format";
import type { BatchInfo, EvalCase } from "../lib/evals";
import type { CaseDelta, GateResult } from "../lib/gate";

type Props = {
  candidate: BatchInfo;                   // the batch on screen
  baselines: BatchInfo[];                 // other finished batches, newest first
  cases: EvalCase[];
  active: string;                         // the prompt version UI runs use now
};

type Comparison = { cases: CaseDelta[]; gate: GateResult };

const batchLabel = (b: BatchInfo) => `${formatDateTime(b.startedAt)} · ${b.promptVersion} · k = ${b.k}`;
const change = (delta: number) => (delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : "0");

export default function GateCompare({ candidate, baselines, cases, active }: Props) {
  const router = useRouter();
  // The active prompt's newest batch is the usual baseline for a new prompt.
  const [baseline, setBaseline] = useState(
    (baselines.find((b) => b.promptVersion === active) ?? baselines[0])?.batch ?? "",
  );
  const [targets, setTargets] = useState<string[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!baseline) return;
    let current = true;
    const query = new URLSearchParams({ a: baseline, b: candidate.batch, targets: targets.join(",") });
    fetch(`/api/evals/compare?${query}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Could not compare the batches (${res.status})`);
        if (current) {
          setComparison(body);
          setError(null);
        }
      })
      .catch((e) => current && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      current = false;
    };
  }, [baseline, candidate.batch, targets]);

  const toggle = (caseId: string) =>
    setTargets((ts) => (ts.includes(caseId) ? ts.filter((t) => t !== caseId) : [...ts, caseId]));

  async function promote() {
    setPromoting(true);
    setError(null);
    try {
      const res = await fetch("/api/prompts/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptVersion: candidate.promptVersion, baseline, candidate: candidate.batch, targets }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error([body.error, ...(body.reasons ?? [])].join(". "));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPromoting(false);
    }
  }

  const verdict = comparison?.gate;
  const isActive = candidate.promptVersion === active;
  const scenario = (caseId: string) => cases.find((c) => c.id === caseId)?.scenario ?? "No longer in the eval set";

  return (
    <section className="card">
      <div className="card-head">
        <h2>Eval gate</h2>
        <label className="field batch-pick">
          <span className="label">Baseline</span>
          <select value={baseline} onChange={(e) => setBaseline(e.target.value)}>
            {baselines.map((b) => (
              <option key={b.batch} value={b.batch}>
                {batchLabel(b)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="hint gate-intro">
        Tick the cases the new prompt is meant to fix. The gate passes only when every target passes more runs than in
        the baseline, no case passes fewer, nothing is invented and no more escalations are missed.
      </p>

      {comparison && (
        <div className="table-wrap">
          <table className="eval-table">
            <thead>
              <tr>
                <th>Target</th>
                <th>Case</th>
                <th>Scenario</th>
                <th className="r">Baseline</th>
                <th className="r">This batch</th>
                <th className="r">Change</th>
              </tr>
            </thead>
            <tbody>
              {comparison.cases.map((c) => (
                <tr key={c.caseId}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Target ${c.caseId}`}
                      checked={targets.includes(c.caseId)}
                      onChange={() => toggle(c.caseId)}
                    />
                  </td>
                  <td className="case-id">{c.caseId}</td>
                  <td>{scenario(c.caseId)}</td>
                  <td className="r">{c.baseline}</td>
                  <td className="r">{c.candidate}</td>
                  <td className={`r delta${c.delta > 0 ? " delta-up" : c.delta < 0 ? " delta-down" : ""}`}>
                    {change(c.delta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {verdict && (
        <p className={`gate-verdict ${verdict.ok ? "gate-pass" : "gate-block"}`}>
          {verdict.ok
            ? "Gate passes: every target improved, no case dropped, nothing invented, no more missed escalations."
            : `Gate blocks: ${verdict.reasons.join("; ")}.`}
        </p>
      )}

      <div className="review-actions">
        <button type="button" className="btn btn-primary" disabled={!verdict?.ok || isActive || promoting} onClick={promote}>
          {promoting ? "Promoting…" : `Promote ${candidate.promptVersion}`}
        </button>
        <span className="hint">
          {isActive
            ? `${candidate.promptVersion} is the active prompt.`
            : `UI runs use ${active} until ${candidate.promptVersion} is promoted.`}
        </span>
      </div>
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
