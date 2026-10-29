import { deleteMemory } from "../../../lib/memory";

export async function DELETE(req: Request) {
  const query = new URL(req.url).searchParams;
  const customer = query.get("customer") ?? "", id = query.get("id") ?? "";
  if (!customer.trim() || !id) return Response.json({ error: "customer and id are required" }, { status: 400 });
  if (!deleteMemory(customer, id)) return Response.json({ error: `No memory ${id} for ${customer}` }, { status: 404 });
  return Response.json({ ok: true });
}
