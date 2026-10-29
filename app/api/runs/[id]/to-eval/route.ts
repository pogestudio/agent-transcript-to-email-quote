import { addEvalCase, feedbackCaseOf } from "../../../../../lib/evals";
import { STATUSES } from "../../../../../lib/status";
import { readRun } from "../../../../../lib/store";
import type { Status } from "../../../../../lib/types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = readRun(id);
  if (!run) return Response.json({ error: `No run with id ${id}` }, { status: 404 });
  if (run.review?.action !== "approve") {
    return Response.json({ error: "Only an approved run can become an eval case" }, { status: 400 });
  }
  if (feedbackCaseOf(id)) return Response.json({ error: "This run is already in the eval set" }, { status: 409 });
  const body = await req.json().catch(() => null);
  const status = body?.status as Status;
  if (!STATUSES.includes(status)) return Response.json({ error: `Unknown status: ${status}` }, { status: 400 });
  return Response.json(addEvalCase(run, status));
}
