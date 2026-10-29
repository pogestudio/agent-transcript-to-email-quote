import { runAgent } from "../../../lib/agent";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const transcript = typeof body?.transcript === "string" ? body.transcript : "";
  if (!transcript.trim()) return Response.json({ error: "transcript is required" }, { status: 400 });
  const customer = typeof body.customer === "string" && body.customer.trim() ? body.customer.trim() : null;
  return Response.json(await runAgent({ transcript, customer, fxFail: body.fxFail === true }));
}
