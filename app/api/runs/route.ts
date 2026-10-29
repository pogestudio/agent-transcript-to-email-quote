import { listRuns } from "../../../lib/store";
import type { Run } from "../../../lib/types";

const SOURCES: Run["source"][] = ["ui", "eval"];

export async function GET(req: Request) {
  const source = new URL(req.url).searchParams.get("source");
  if (source && !SOURCES.includes(source as Run["source"])) {
    return Response.json({ error: `source must be one of ${SOURCES.join(", ")}` }, { status: 400 });
  }
  return Response.json(listRuns((source as Run["source"]) ?? undefined));
}
