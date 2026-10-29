import { describe, expect, it } from "vitest";
import { assemble } from "./assemble";
import { formatSek } from "./format";
import { applyReview, followUpTranscript, type ReviewInput, type Reviewed } from "./review";
import type { Extraction, Run } from "./types";

const AT = "2026-10-29T18:00:00.000Z";

const extraction = (fields: Partial<Extraction> = {}): Extraction => ({
  customer: "Café Linnea", currency: "SEK", lines: [], notInCatalog: [],
  requestedDiscountPct: null, questions: [], deliveryNote: null, ...fields,
});
const line = (sku: string, kg: number | null) => ({ sku, kg, evidence: "" });

// A run as runAgent saves it: the model's extraction through the real assemble().
const run = (x: Extraction, fields: Partial<Run> = {}): Run => ({
  id: "r_1", createdAt: AT, source: "ui", transcript: "", customer: x.customer, fxFail: false,
  promptVersion: "v1", memoryUsed: [], extraction: x, ...assemble(x, null, null, null), error: null,
  totals: { steps: 3, inputTokens: 5000, outputTokens: 400, costUsd: 0.014, ms: 5000 }, ...fields,
});

const TC01 = run(extraction({ lines: [line("KV-ESP-01", 20)] }));
const TC04 = run(extraction({ customer: "Hotell Fjällgatan", lines: [line("KV-ESP-01", 120)], requestedDiscountPct: 15 }));
const TC05 = run(extraction({ customer: "Bageri Kanel", lines: [line("KV-ESP-02", null)] }));
const TC10 = run(extraction({ customer: "Glassbaren Ven", lines: [line("KV-ESP-01", 25), line("KV-CLD-01", 8)] }));

const review = (r: Run, input: ReviewInput) => applyReview(r, input, AT);
const saved = (r: Run, input: ReviewInput) => review(r, input) as Reviewed;

describe("applyReview", () => {
  it("needs a reason to reject", () => {
    expect(review(TC01, { action: "reject", reason: "  " })).toEqual({ error: "Add a reason to reject." });
    expect(review(TC01, { action: "reject", reason: "Wrong customer" }))
      .toEqual({ review: { action: "reject", reason: "Wrong customer", at: AT } });
  });

  it("keeps the agent's quote and email when a ready run is approved as it is", () => {
    expect(review(TC01, { action: "approve" })).toEqual({ review: { action: "approve", reason: "", at: AT } });
  });

  it("prices edited lines with the same code as the agent", () => {
    const out = saved(TC10, { action: "approve", editedLines: [{ sku: "KV-ESP-01", kg: 25 }, { sku: "KV-CLD-01", kg: 10 }] });
    expect(out.review.editedLines).toEqual([{ sku: "KV-ESP-01", kg: 25 }, { sku: "KV-CLD-01", kg: 10 }]);
    expect(out.editedQuote?.totalExclVatSek).toBe(8200);
    expect(out.editedEmail).toContain(`Total excl. VAT: ${formatSek(8200)}`);
    expect(out.editedEmail).not.toContain("Before we can finalise");
    expect(TC10.quote?.totalExclVatSek).toBe(7760);   // the agent's draft is left as it was
  });

  it("lets a manager set the discount on a needs_approval run", () => {
    const out = saved(TC04, { action: "approve", discountPct: 15 });
    expect(out.review).toMatchObject({ asManager: true, discountPct: 15 });
    expect(out.editedQuote).toMatchObject({ discountSek: 4320, totalExclVatSek: 24480 });
    expect(out.editedEmail).toContain(`Discount (15%): ${formatSek(4320)} off`);
  });

  it("keeps the draft email when a manager approves without changes", () => {
    expect(review(TC04, { action: "approve" }))
      .toEqual({ review: { action: "approve", reason: "", at: AT, asManager: true } });
  });

  it("gives a needs_info run approved without changes an email without the questions", () => {
    const out = saved(TC10, { action: "approve" });
    expect(out.editedQuote).toBeUndefined();
    expect(TC10.email).toContain("Before we can finalise the quote:");
    expect(out.editedEmail).not.toContain("Before we can finalise the quote:");
  });

  it.each([
    ["a run that isn't needs_approval", TC01, 15],
    ["above 100%", TC04, 101],
    ["a part of a percent", TC04, 2.5],
    ["below 0%", TC04, -1],
  ])("refuses a discount on %s", (_, r, discountPct) => {
    expect(review(r, { action: "approve", discountPct })).toHaveProperty("error");
  });

  it.each([
    [[{ sku: "KV-KEN-01", kg: 10 }], "Unknown SKU: KV-KEN-01"],
    [[{ sku: "KV-ESP-01", kg: 0 }], "kg must be a whole number of at least 1, got 0"],
    ["20 kg", "editedLines must be a list of { sku, kg }"],
  ])("refuses edited lines %j", (editedLines, error) => {
    expect(review(TC01, { action: "approve", editedLines })).toEqual({ error });
  });

  it("refuses to approve a quote without lines", () => {
    expect(review(TC05, { action: "approve" })).toEqual({ error: "Add a quantity before approving." });
  });

  it("keeps the customer answers and the note to remember on a rerun", () => {
    expect(review(TC05, { action: "rerun", customerAnswers: " 20 kg ", remember: "Orders on Mondays" })).toEqual({
      review: { action: "rerun", reason: "", at: AT, remember: "Orders on Mondays", customerAnswers: "20 kg" },
    });
  });

  it("refuses a note to remember without a customer name", () => {
    expect(review({ ...TC01, customer: null }, { action: "rerun", remember: "Orders on Mondays" })).toHaveProperty("error");
  });

  it("refuses an eval run and an unknown action", () => {
    expect(review({ ...TC01, source: "eval" }, { action: "approve" })).toHaveProperty("error");
    expect(review(TC01, { action: "edit" })).toEqual({ error: "Unknown action: edit" });
  });
});

describe("followUpTranscript", () => {
  it("adds the customer's answers after the call", () => {
    expect(followUpTranscript("C: A few bags.\n", "20 kg")).toBe("C: A few bags.\n\n[Customer follow-up]\n20 kg\n");
    expect(followUpTranscript("C: A few bags.\n")).toBe("C: A few bags.\n");
  });
});
