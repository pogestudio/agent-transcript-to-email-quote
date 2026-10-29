import { readRun, writeJson } from "../../../../../lib/store";

// Nothing is emailed: the person sent it from their own mail and records that here.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = readRun(id);
  if (!run) return Response.json({ error: `No run with id ${id}` }, { status: 404 });
  if (run.review?.action !== "approve") {
    return Response.json({ error: "Only an approved run can be marked as sent" }, { status: 400 });
  }
  if (run.sentAt) return Response.json({ error: "This run is already marked as sent" }, { status: 409 });
  const saved = { ...run, sentAt: new Date().toISOString() };
  writeJson(`runs/${id}.json`, saved);
  return Response.json({ run: saved });
}
