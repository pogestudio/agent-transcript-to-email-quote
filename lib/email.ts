import { formatDateTime, formatDay, formatQuoteAmount, formatRate } from "./format";
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
    // Every amount is in the customer's currency when there is a rate; the pricing itself stays in SEK.
    const { fx } = quote;
    const amount = (sek: number) => formatQuoteAmount(sek, fx);
    out.push("Here is your quote from Kvarn Coffee Roasters:", "");
    for (const line of quote.lines) out.push(`${line.kg} kg ${line.name}: ${amount(line.lineSek)}`);
    if (quote.discountPct > 0) {
      const label = quote.discountPct === volumeDiscountPct(quote.totalKg) ? "Volume discount" : "Discount";
      out.push(`${label} (${quote.discountPct}%): ${amount(quote.discountSek)} off`);
    }
    out.push(
      `Delivery: ${quote.deliverySek ? amount(quote.deliverySek) : "free"}`,
      `Total excl. VAT: ${amount(quote.totalExclVatSek)}`,
      `VAT ${VAT_RATE * 100}%: ${amount(quote.vatSek)}`,
      `Total incl. VAT: ${amount(quote.totalInclVatSek)}`,
    );
    if (fx) {
      out.push(
        "",
        `1 SEK = ${formatRate(fx.rate)} ${fx.currency}, ECB reference rate of ${formatDay(fx.rateDate)}, fetched ${formatDateTime(fx.fetchedAt)}.`,
        "Each amount is converted on its own and rounded to the cent.",
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
