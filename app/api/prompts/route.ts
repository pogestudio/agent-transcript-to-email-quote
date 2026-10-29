import { activePromptVersion, listPromptVersions } from "../../../lib/agent";

export async function GET() {
  return Response.json({ versions: listPromptVersions(), active: activePromptVersion() });
}
