import Link from "next/link";
import { formatDateTime } from "../lib/format";
import type { Correction } from "../lib/corrections";
import type { EvalCase, EvalResult } from "../lib/evals";

type Props = {
  corrections: Correction[];
  cases: EvalCase[];
  failed: EvalResult[];                   // the failed runs of the batch on screen
  k: number;
};

const ACTION_LABEL: Record<Correction["action"], string> = { approve: "Approved", reject: "Rejected", rerun: "Rerun" };

// Reasons are free text and never classified: a person reads both lists to find what keeps coming back.
export default function Corrections({ corrections, cases, failed, k }: Props) {
  const failing = cases.filter((c) => failed.some((r) => r.caseId === c.id));

  return (
    <section className="card">
      <div className="card-head">
        <h2>Recurring corrections</h2>
        <span className="hint">What reviewers changed, next to what this batch failed</span>
      </div>
      <div className="two-col">
        <div>
          <h3 className="label">Reviewer corrections, newest first</h3>
          {corrections.length === 0 ? (
            <p className="muted">No reasons or approved edits yet.</p>
          ) : (
            <ul className="memory-list">
              {corrections.map((c) => (
                <li key={`${c.runId}-${c.at}`} className="correction">
                  <span className="hint">
                    {formatDateTime(c.at)} · {ACTION_LABEL[c.action]} · {c.customer ?? "No customer"} ·{" "}
                    <Link href={`/runs/${c.runId}`}>{c.runId}</Link>
                  </span>
                  {c.reason && <span>“{c.reason}”</span>}
                  {c.approved && (
                    <span className="small">
                      Agent: {c.draft} → Approved: {c.approved}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="label">Failing in this batch</h3>
          {failing.length === 0 ? (
            <p className="muted">Every run in this batch passed.</p>
          ) : (
            <ul className="memory-list">
              {failing.map((c) => {
                const runs = failed.filter((r) => r.caseId === c.id);
                return (
                  <li key={c.id} className="correction">
                    <span>
                      <span className="case-id">{c.id}</span> {c.scenario}
                    </span>
                    <span className="marks">
                      {runs.map((r) => (
                        <Link key={r.runId} href={`/runs/${r.runId}`} className="mark mark-fail" title={`Failed: ${r.failed.join(", ")}`}>
                          ✗
                        </Link>
                      ))}
                      <span className="hint">
                        {runs.length} of {k} runs failed: {[...new Set(runs.flatMap((r) => r.failed))].join(", ")}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
