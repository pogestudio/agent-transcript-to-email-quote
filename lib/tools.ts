import type Anthropic from "@anthropic-ai/sdk";
import { CATALOG } from "./catalog";
import { getRate, type FxContext } from "./fx";
import { priceLine } from "./pricing";

export const TOOL_SCHEMAS: Anthropic.Tool[] = [
  { name: "search_products",
    description: "Search the Kvarn catalog. Returns matching products without prices. An empty list means we don't sell it.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "price_line",
    description: "Undiscounted line price in SEK excl. VAT plus the minimum-order check. Discount, delivery, VAT and currency are applied later by the system.",
    input_schema: { type: "object", properties: { sku: { type: "string" }, kg: { type: "integer", minimum: 1 } }, required: ["sku", "kg"] } },
  { name: "convert_currency",
    description: "Convert SEK to another currency at today's live rate. Returns ok:false when the rate can't be fetched. Never guess a rate.",
    input_schema: { type: "object", properties: { amount_sek: { type: "number" }, currency: { type: "string", description: "ISO 4217 code, e.g. EUR" } }, required: ["amount_sek", "currency"] } },
];

const words = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

// A product matches when any query word is a whole word of its name or keywords. Prices only come from price_line.
export function searchProducts(query: string) {
  const queryWords = new Set(words(query));
  return CATALOG
    .filter((p) => words([p.name, ...p.keywords].join(" ")).some((w) => queryWords.has(w)))
    .map(({ sku, name, minKg }) => ({ sku, name, minKg }));
}

async function convertCurrency(amount: number, currency: string, ctx: FxContext) {
  const cur = currency.trim().toUpperCase();
  if (cur === "SEK") return { ok: true, currency: cur, amount, rate: 1 };
  const r = await getRate(cur, ctx);
  return r.ok ? { ...r, amount: Math.round(amount * r.rate * 100) / 100 } : r;
}

export function makeTools(ctx: FxContext) {
  return {
    // Never throws: a bad call goes back to the model as { error }.
    async call(name: string, input: unknown): Promise<object> {
      try {
        const args = (input ?? {}) as Record<string, unknown>;
        switch (name) {
          case "search_products":
            if (typeof args.query !== "string") return { error: "query must be a string" };
            return searchProducts(args.query);
          case "price_line":
            if (typeof args.sku !== "string" || typeof args.kg !== "number") return { error: "sku must be a string and kg a number" };
            return priceLine(args.sku, args.kg);   // throws on an unknown SKU or a bad kg
          case "convert_currency":
            if (typeof args.amount_sek !== "number" || !Number.isFinite(args.amount_sek) || typeof args.currency !== "string") {
              return { error: "amount_sek must be a number and currency a string" };
            }
            return await convertCurrency(args.amount_sek, args.currency, ctx);
          default:
            return { error: `Unknown tool: ${name}` };
        }
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}
