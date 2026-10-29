import { listPromptVersions, setActivePromptVersion } from "../../../../lib/agent";
import { gate, loadPair } from "../../../../lib/gate";

// The gate runs again here, so a stale page can't promote a prompt the gate now blocks.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { promptVersion, baseline, candidate, targets } = body ?? {};
  if (!listPromptVersions().includes(promptVersion)) {
    return Response.json({ error: `Unknown prompt version: ${promptVersion}` }, { status: 400 });
  }
  if (!Array.isArray(targets) || !targets.every((t) => typeof t === "string")) {
    return Response.json({ error: "targets must be a list of case ids" }, { status: 400 });
  }
  const pair = loadPair(baseline, candidate);
  if ("error" in pair) return Response.json({ error: pair.error }, { status: pair.status });
  if (pair.candidate.promptVersion !== promptVersion) {
    return Response.json(
      { error: `Batch ${candidate} ran ${pair.candidate.promptVersion}, not ${promptVersion}` }, { status: 400 },
    );
  }
  const verdict = gate(pair.baseline, pair.candidate, targets);
  if (!verdict.ok) return Response.json({ error: "The eval gate blocks this prompt", reasons: verdict.reasons }, { status: 409 });
  setActivePromptVersion(promptVersion);
  return Response.json({ active: promptVersion });
}
