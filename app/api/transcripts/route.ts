import { listTranscripts } from "../../../lib/store";

export async function GET() {
  return Response.json(listTranscripts().map((t) => t.name));
}
