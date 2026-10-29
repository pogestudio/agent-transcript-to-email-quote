import { formatDateTime, formatDay, formatMoney, formatRate, formatSek } from "./format";
import { discountPct as volumeDiscountPct, VAT_RATE } from "./pricing";
import type { Quote, Status } from "./types";

type EmailInput = {
  customer: string | null;
  quote: Quote | null;
  status: Status;
  questions: string[];
  notInCatalog: string[];
  deliveryNote: string | null;
  approved?: boolean;     // a person approved it: no open questions
};

// A discount above the volume tier only appears here after a manager set it on the quote.
export function buildEmail({ customer, quote, status, questions, notInCatalog, deliveryNote, approved = false }: EmailInput): string {
  const out = [customer ? `Hi ${customer},` : "Hi,", "", "Thanks for the call today."];

  if (quote && quote.lines.length > 0) {
    out.push("Here is your quote from Kvarn Coffee Roasters:", "");
    for (const line of quote.lines) out.push(`${line.kg} kg ${line.name}: ${formatSek(line.lineSek)}`);
    if (quote.discountPct > 0) {
      const label = quote.discountPct === volumeDiscountPct(quote.totalKg) ? "Volume discount" : "Discount";
      out.push(`${label} (${quote.discountPct}%): ${formatSek(quote.discountSek)} off`);
    }
    out.push(
      `Delivery: ${quote.deliverySek ? formatSek(quote.deliverySek) : "free"}`,
      `Total excl. VAT: ${formatSek(quote.totalExclVatSek)}`,
      `VAT ${VAT_RATE * 100}%: ${formatSek(quote.vatSek)}`,
      `Total incl. VAT: ${formatSek(quote.totalInclVatSek)}`,
    );
    if (quote.fx) {
      const { currency, rate, rateDate, fetchedAt, totalExclVat, totalInclVat } = quote.fx;
      out.push(
        "",
        `In ${currency}: ${formatMoney(totalExclVat, currency)} excl. VAT, ${formatMoney(totalInclVat, currency)} incl. VAT.`,
        `1 SEK = ${formatRate(rate)} ${currency}, ECB reference rate of ${formatDay(rateDate)}, fetched ${formatDateTime(fetchedAt)}.`,
      );
    }
    if (quote.fxError) out.push("", "Prices are in SEK because today's exchange rate couldn't be fetched.");
  }

  // When the questions are listed, they already name each item we don't sell.
  const asking = !approved && status === "needs_info" && questions.length > 0;
  if (!asking) for (const item of notInCatalog) out.push("", `We don't sell ${item}. Would one of our other coffees work?`);
  if (deliveryNote) out.push("", deliveryNote.replace(/[.!]?$/, "."));

  // The email goes to the customer, so it never mentions the manager's approval: that step is internal.
  if (asking) {
    out.push("", "Before we can finalise the quote:");
    questions.forEach((q, i) => out.push(`${i + 1}. ${q}`));
  } else {
    out.push("", "Reply to this email to confirm the order.");
  }

  out.push("", "Best regards,", "Kvarn Coffee Roasters");
  return out.join("\n");
}
