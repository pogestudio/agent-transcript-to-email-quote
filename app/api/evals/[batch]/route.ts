import { readBatch, summarize } from "../../../../lib/evals";

export async function GET(_req: Request, { params }: { params: Promise<{ batch: string }> }) {
  const { batch } = await params;
  const found = readBatch(batch);
  if (!found) return Response.json({ error: `No eval batch with id ${batch}` }, { status: 404 });
  return Response.json({ ...found, summary: summarize(found.results, found.k) });
}
