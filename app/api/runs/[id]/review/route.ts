import { runAgent } from "../../../../../lib/agent";
import { addMemory } from "../../../../../lib/memory";
import { applyReview, followUpTranscript } from "../../../../../lib/review";
import { appendJsonl, readRun, writeJson } from "../../../../../lib/store";
import type { Run } from "../../../../../lib/types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = readRun(id);
  if (!run) return Response.json({ error: `No run with id ${id}` }, { status: 404 });
  if (run.review) return Response.json({ error: "This run is already reviewed" }, { status: 409 });
  const body = await req.json().catch(() => null);
  const out = applyReview(run, body ?? {}, new Date().toISOString());
  if ("error" in out) return Response.json({ error: out.error }, { status: 400 });

  // A refused note stops the review before anything is saved.
  if (out.review.remember) {
    try {
      addMemory(run.customer ?? "", out.review.remember, run.id);
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
    }
  }
  const saved: Run = { ...run, ...out };
  writeJson(`runs/${id}.json`, saved);
  appendJsonl("feedback.jsonl", { runId: id, ...out.review });
  if (out.review.action !== "rerun") return Response.json({ run: saved });

  const child = await runAgent({
    transcript: followUpTranscript(run.transcript, out.review.customerAnswers),
    customer: run.customer, fxFail: run.fxFail, parentId: id,
  });
  return Response.json({ run: saved, newRunId: child.id });
}
