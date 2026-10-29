import { findProduct } from "./catalog";
import { buildEmail } from "./email";
import { computeQuote } from "./pricing";
import { decideStatus } from "./status";
import type { Extraction, Fx, Quote, Status } from "./types";

export type Assembled = {
  quote: Quote | null; status: Status; reasons: string[]; questions: string[];
  email: string; blockedSkus: string[];
};

// The model reads, code computes: every number, the status and the email come from here.
export function assemble(
  extraction: Extraction | null,
  fx: Fx | null,
  fxError: string | null,
  agentError: string | null,
): Assembled {
  if (!extraction) {
    return {
      quote: null, status: "needs_info", questions: [], email: "", blockedSkus: [],
      reasons: [`Agent could not finish: ${agentError ?? "no extraction"}. See the trace`],
    };
  }

  // SKUs the model proposed that we don't sell never reach the quote.
  const blockedSkus = extraction.lines.filter((l) => !findProduct(l.sku)).map((l) => l.sku);
  const checked: Extraction = {
    ...extraction,
    lines: extraction.lines.filter((l) => findProduct(l.sku)),
    notInCatalog: [...extraction.notInCatalog, ...blockedSkus.map((sku) => `${sku} (unknown code)`)],
  };

  const priced = checked.lines.flatMap((l) => (l.kg === null ? [] : [{ sku: l.sku, kg: l.kg }]));
  const quote = computeQuote(priced, fx, fxError);
  const { status, reasons, questions } = decideStatus(checked, quote, fxError);
  const email = buildEmail({
    customer: extraction.customer, quote, status, questions,
    notInCatalog: checked.notInCatalog, deliveryNote: extraction.deliveryNote,
  });
  return { quote, status, reasons, questions, email, blockedSkus };
}
