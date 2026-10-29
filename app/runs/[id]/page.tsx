import { notFound } from "next/navigation";
import RunDetail from "../../../components/RunDetail";
import TraceView from "../../../components/TraceView";
import { readJson, readJsonl } from "../../../lib/store";
import type { Run, TraceEvent } from "../../../lib/types";

const RUN_ID = /^r_\w+$/;

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = RUN_ID.test(id) ? readJson<Run>(`runs/${id}.json`) : null;
  if (!run) notFound();
  const trace = readJsonl<TraceEvent>(`traces/${id}.jsonl`);

  return (
    <>
      <RunDetail run={run} />
      <section className="card">
        <div className="card-head">
          <h2>Trace</h2>
        </div>
        <TraceView totals={run.totals} events={trace} />
      </section>
    </>
  );
}
