import { after } from "next/server";
import { listPromptVersions } from "../../../lib/agent";
import { DEFAULT_K, listBatches, MAX_K, runSuite } from "../../../lib/evals";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const promptVersion = body?.promptVersion;
  if (!listPromptVersions().includes(promptVersion)) {
    return Response.json({ error: `Unknown prompt version: ${promptVersion}` }, { status: 400 });
  }
  const k = body.k ?? DEFAULT_K;
  if (!Number.isInteger(k) || k < 1 || k > MAX_K) {
    return Response.json({ error: `k must be a whole number from 1 to ${MAX_K}` }, { status: 400 });
  }
  // The suite keeps running after the response; the Evals page polls the batch.
  const { batch, done } = runSuite(promptVersion, k);
  after(done);
  return Response.json({ batch });
}

export async function GET() {
  return Response.json(listBatches());
}
