import { describe, expect, it } from "vitest";
import { buildEmail } from "./email";
import { formatDateTime, formatDay, formatMoney, formatRate, formatSek } from "./format";
import { computeQuote } from "./pricing";
import type { Fx } from "./types";

const EUR: Fx = {
  currency: "EUR", rate: 0.0871, rateDate: "2026-10-28", fetchedAt: "2026-10-29T09:14:03.412Z",
  source: "Frankfurter (ECB reference rates)",
};
const TC01 = [{ sku: "KV-ESP-01", kg: 20 }];
const TC04 = [{ sku: "KV-ESP-01", kg: 120 }];
const base = { customer: "Café Linnea", status: "ready_for_review" as const, questions: [], notInCatalog: [], deliveryNote: null };

// sv-SE groups thousands with a non breaking space, so amounts are compared through formatSek.
describe("buildEmail", () => {
  it("TC01 greets the customer and lists the line, delivery and totals", () => {
    const email = buildEmail({ ...base, quote: computeQuote(TC01, null, null) });
    expect(email).toContain("Hi Café Linnea,");
    expect(email).toContain(`20 kg House Espresso: ${formatSek(4800)}`);
    expect(email).toContain(`Delivery: ${formatSek(250)}`);
    expect(email).toContain(`Total excl. VAT: ${formatSek(5050)}`);
    expect(email).toContain(`Total incl. VAT: ${formatSek(6312.5)}`);
    expect(email).toContain("Best regards,");
  });

  it('says "Hi," without a customer name', () => {
    expect(buildEmail({ ...base, customer: null, quote: computeQuote(TC01, null, null) })).toMatch(/^Hi,\n/);
  });

  it("shows the converted totals, rate, rate date and fetch time", () => {
    const lines = [{ sku: "KV-FIL-01", kg: 40 }, { sku: "KV-ESP-02", kg: 20 }];
    const email = buildEmail({ ...base, quote: computeQuote(lines, EUR, null) });
    expect(email).toContain(formatMoney(1208.08, "EUR"));
    expect(email).toContain(`1 SEK = ${formatRate(EUR.rate)} EUR`);
    expect(email).toContain(formatDay(EUR.rateDate));
    expect(email).toContain(formatDateTime(EUR.fetchedAt));
  });

  it("explains an FX failure", () => {
    const email = buildEmail({ ...base, quote: computeQuote([{ sku: "KV-ORG-01", kg: 30 }], null, "timeout") });
    expect(email).toContain("Prices are in SEK because today's exchange rate couldn't be fetched.");
    expect(email).toContain("Delivery: free");
  });

  it("numbers the questions when the status is needs_info", () => {
    const questions = ["How many kg of Single Origin Ethiopia would you like?", "Which day suits delivery?"];
    const email = buildEmail({ ...base, status: "needs_info", questions, quote: computeQuote([], null, null) });
    expect(email).toContain(`1. ${questions[0]}\n2. ${questions[1]}`);
  });

  it("names an item we don't sell once, as a question while the status is needs_info", () => {
    const notSold = "We don't sell Kenya AA. Would one of our other coffees work?";
    const asking = { ...base, status: "needs_info" as const, questions: [notSold], notInCatalog: ["Kenya AA"],
      quote: computeQuote([{ sku: "KV-FIL-01", kg: 20 }], null, null) };
    expect(buildEmail(asking).split(notSold)).toHaveLength(2);
    expect(buildEmail(asking)).toContain(`1. ${notSold}`);
    expect(buildEmail({ ...asking, approved: true }).split(notSold)).toHaveLength(2);
  });

  it("an approved email has no pending manager line and no questions", () => {
    const pending = { ...base, status: "needs_approval" as const, quote: computeQuote(TC04, null, null) };
    expect(buildEmail(pending)).toContain("Our sales manager will confirm");
    expect(buildEmail({ ...pending, approved: true })).not.toContain("Our sales manager will confirm");

    const questions = ["How many kg of Single Origin Ethiopia would you like?"];
    const asking = { ...base, status: "needs_info" as const, questions, quote: computeQuote(TC01, null, null) };
    expect(buildEmail({ ...asking, approved: true })).not.toContain(questions[0]);
  });

  it('labels the standard tier "Volume discount" and a manager override "Discount"', () => {
    expect(buildEmail({ ...base, quote: computeQuote(TC04, null, null) })).toContain(`Volume discount (10%): ${formatSek(2880)} off`);
    const override = buildEmail({ ...base, quote: computeQuote(TC04, null, null, 15), approved: true });
    expect(override).toContain(`Discount (15%): ${formatSek(4320)} off`);
    expect(override).not.toContain("Volume discount");
  });
});
