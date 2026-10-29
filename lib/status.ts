import { findProduct } from "./catalog";
import { formatSek } from "./format";
import { APPROVAL_LIMIT_SEK } from "./pricing";
import type { Extraction, Quote, Status } from "./types";

export type StatusResult = { status: Status; reasons: string[]; questions: string[] };

// Every rule that fires adds its reason; the status is the highest one that fired.
export function decideStatus(extraction: Extraction, quote: Quote | null, fxError: string | null): StatusResult {
  const info: string[] = [];
  const approval: string[] = [];
  const questions: string[] = [];
  const ask = (reason: string, question: string) => {
    info.push(reason);
    questions.push(question);
  };

  for (const line of extraction.lines) {
    if (line.kg !== null) continue;
    const name = findProduct(line.sku)?.name ?? line.sku;
    ask(`Quantity unclear for ${name}`, `How many kg of ${name} would you like?`);
  }
  for (const line of quote?.lines ?? []) {
    if (!line.belowMin) continue;
    ask(`${line.name}: ${line.kg} kg is below the ${line.minKg} kg minimum`,
      `The minimum for ${line.name} is ${line.minKg} kg. Would that work?`);
  }
  for (const item of extraction.notInCatalog) {
    ask(`"${item}" is not in our catalog`, `We don't sell ${item}. Would one of our other coffees work?`);
  }
  // Only when nothing else explains the empty order.
  if (!extraction.lines.length && !extraction.notInCatalog.length && !extraction.questions.length) {
    ask("No product identified", "Which coffees would you like to order?");
  }
  if (extraction.questions.length) {
    info.push("The agent has open questions");
    questions.push(...extraction.questions);
  }

  const standardPct = quote?.discountPct ?? 0;
  const askedPct = extraction.requestedDiscountPct;
  if (askedPct !== null && askedPct > standardPct) {
    approval.push(`Asked for ${askedPct}%; standard is ${standardPct}%. Quote uses ${standardPct}%`);
  }
  if (quote && quote.goodsAfterDiscountSek > APPROVAL_LIMIT_SEK) {
    approval.push(`${formatSek(quote.goodsAfterDiscountSek)} after discount is above the ${formatSek(APPROVAL_LIMIT_SEK)} limit`);
  }

  const status: Status = info.length ? "needs_info" : approval.length ? "needs_approval" : "ready_for_review";
  const reasons = [...info, ...approval, ...(fxError ? ["Exchange rate lookup failed; quote kept in SEK"] : [])];
  return { status, reasons: reasons.length ? reasons : ["All pricing rules met"], questions };
}
