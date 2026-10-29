"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "./StatusBadge";
import { formatDateTime, formatSeconds, formatUsd } from "../lib/format";
import type { BatchInfo, EvalBatch, EvalCase, EvalResult, Summary, Tally } from "../lib/evals";

export type BatchView = EvalBatch & { summary: Summary };

type Props = {
  cases: EvalCase[];
  batches: BatchInfo[];
  initial: BatchView;
};

const POLL_MS = 2000;

const ratio = (t: Tally, sep = " / ") => (t.of ? `${t.ok}${sep}${t.of}` : "n/a");
const percent = (t: Tally) => (t.of ? `${Math.round((t.ok / t.of) * 100)}%` : "n/a");

function RunMark({ result }: { result: EvalResult }) {
  return (
    <Link
      href={`/runs/${result.runId}`}
      className={`mark ${result.pass ? "mark-pass" : "mark-fail"}`}
      title={result.pass ? "Passed" : `Failed: ${result.failed.join(", ")}`}
    >
      {result.pass ? "✓" : "✗"}
    </Link>
  );
}

export default function EvalResults({ cases, batches, initial }: Props) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const running = view.status === "running";

  // Poll while the batch runs. Once it's done, refresh the page so the batch list and the form catch up.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/evals/${view.batch}`).catch(() => null);
      if (!res?.ok) return;
      const next: BatchView = await res.json();
      setView(next);
      if (next.status === "done") router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [running, view.batch, router]);

  const s = view.summary;
  const stats: { label: string; value: string; sub?: string; bad?: boolean }[] = [
    { label: "Runs passed", value: ratio(s.passed) },
    { label: "Cases passed (pass^k)", value: ratio(s.passK), sub: `all ${view.k} runs pass` },
    { label: "Lines", value: percent(s.lines), sub: ratio(s.lines) },
    { label: "Total", value: percent(s.total), sub: ratio(s.total) },
    { label: "Status", value: percent(s.status), sub: ratio(s.status) },
    { label: "Over escalated", value: String(s.overEscalated) },
    { label: "Under escalated", value: String(s.underEscalated) },
    { label: "Invented", value: String(s.invented), sub: "must be 0", bad: s.invented > 0 },
    { label: "Blocked SKUs", value: String(s.blocked) },
    { label: "Cost per run", value: formatUsd(s.costUsd.mean), sub: `${formatUsd(s.costUsd.min)} to ${formatUsd(s.costUsd.max)}` },
    { label: "Latency", value: formatSeconds(s.ms.median), sub: `median, max ${formatSeconds(s.ms.max)}` },
  ];
  const shownCases = running ? cases : cases.filter((c) => s.cases.some((row) => row.caseId === c.id));

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>Results</h2>
          <label className="field batch-pick">
            <span className="label">Batch</span>
            <select value={view.batch} onChange={(e) => router.push(`/evals?batch=${e.target.value}`)}>
              {batches.map((b) => (
                <option key={b.batch} value={b.batch}>
                  {formatDateTime(b.startedAt)} · {b.promptVersion} · k = {b.k}
                  {b.status === "running" ? " · running" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="progress">
          {running
            ? `Running… ${view.results.length} / ${cases.length * view.k} runs`
            : `Prompt ${view.promptVersion}, k = ${view.k}, finished ${view.finishedAt ? formatDateTime(view.finishedAt) : ""}`}
        </p>
        <div className="eval-stats">
          {stats.map(({ label, value, sub, bad }) => (
            <div key={label} className={`stat${bad ? " stat-bad" : ""}`}>
              <div className="stat-label">{label}</div>
              <div className="stat-value">{value}</div>
              {sub && <div className="stat-sub">{sub}</div>}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Per case</h2>
          <span className="hint">Each mark opens its run and trace</span>
        </div>
        <div className="table-wrap">
          <table className="eval-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Scenario</th>
                <th>Expected</th>
                <th>Runs</th>
                <th className="r">Lines</th>
                <th className="r">Total</th>
                <th className="r">Status</th>
              </tr>
            </thead>
            <tbody>
              {shownCases.map((c) => {
                const row = s.cases.find((r) => r.caseId === c.id);
                const results = row?.results ?? [];
                const pending = running ? Math.max(view.k - results.length, 0) : 0;
                return (
                  <tr key={c.id}>
                    <td className="case-id">{c.id}</td>
                    <td>{c.scenario}</td>
                    <td>
                      <StatusBadge status={c.expected.status} />
                    </td>
                    <td>
                      <span className="marks">
                        {results.map((r) => (
                          <RunMark key={r.runId} result={r} />
                        ))}
                        {Array.from({ length: pending }, (_, i) => (
                          <span key={i} className="mark mark-pending" title="Queued or running">
                            ·
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="r">{row ? ratio(row.lines, "/") : ""}</td>
                    <td className="r">{row ? ratio(row.total, "/") : ""}</td>
                    <td className="r">{row ? ratio(row.status, "/") : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
