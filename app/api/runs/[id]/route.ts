import { listRuns, readJson, readJsonl } from "../../../../lib/store";
import type { Run, TraceEvent } from "../../../../lib/types";

const RUN_ID = /^r_\w+$/;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = RUN_ID.test(id) ? readJson<Run>(`runs/${id}.json`) : null;
  if (!run) return Response.json({ error: `No run with id ${id}` }, { status: 404 });
  const trace = readJsonl<TraceEvent>(`traces/${id}.jsonl`);
  const children = listRuns().filter((r) => r.parentId === id);
  return Response.json({ run, trace, children });
}
