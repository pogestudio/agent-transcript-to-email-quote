import { readTranscript } from "../../../../lib/store";

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const text = readTranscript(name);
  if (text === null) return Response.json({ error: `No transcript named ${name}` }, { status: 404 });
  return Response.json({ name, text });
}
