import { compareBatches, gate, loadPair } from "../../../../lib/gate";

// a is the baseline, b the candidate, targets a comma separated list of case ids.
export async function GET(req: Request) {
  const query = new URL(req.url).searchParams;
  const pair = loadPair(query.get("a"), query.get("b"));
  if ("error" in pair) return Response.json({ error: pair.error }, { status: pair.status });
  const targets = (query.get("targets") ?? "").split(",").filter(Boolean);
  return Response.json({
    cases: compareBatches(pair.baseline, pair.candidate),
    gate: gate(pair.baseline, pair.candidate, targets),
  });
}
