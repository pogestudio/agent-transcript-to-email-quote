import { notFound } from "next/navigation";
import RunDetail from "../../../components/RunDetail";
import TraceView from "../../../components/TraceView";
import { diffRuns } from "../../../lib/diff";
import { feedbackCaseOf } from "../../../lib/evals";
import { memoriesFor } from "../../../lib/memory";
import { listRuns, readJsonl, readRun } from "../../../lib/store";
import type { TraceEvent } from "../../../lib/types";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = readRun(id);
  if (!run) notFound();
  const trace = readJsonl<TraceEvent>(`traces/${id}.jsonl`);
  const parent = run.parentId ? readRun(run.parentId) : null;
  const reruns = listRuns().filter((r) => r.parentId === id).map((r) => ({ id: r.id, createdAt: r.createdAt }));

  return (
    <>
      <RunDetail
        run={run}
        changes={parent ? diffRuns(parent, run) : null}
        reruns={reruns}
        activeMemoryIds={memoriesFor(run.customer).map((m) => m.id)}
        evalCaseId={feedbackCaseOf(id)?.id ?? null}
      />
      <section className="card">
        <div className="card-head">
          <h2>Trace</h2>
        </div>
        <TraceView totals={run.totals} events={trace} />
      </section>
    </>
  );
}
