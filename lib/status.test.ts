import { describe, expect, it } from "vitest";
import { formatSek } from "./format";
import { computeQuote } from "./pricing";
import { decideStatus } from "./status";
import type { Extraction } from "./types";

const extraction = (fields: Partial<Extraction> = {}): Extraction => ({
  customer: "Café Linnea", currency: "SEK", lines: [], notInCatalog: [],
  requestedDiscountPct: null, questions: [], deliveryNote: null, ...fields,
});
const line = (sku: string, kg: number | null) => ({ sku, kg, evidence: "" });

// Prices the clear lines the way assemble() does, then decides.
const decide = (ex: Extraction, fxError: string | null = null) => {
  const priced = ex.lines.flatMap((l) => (l.kg === null ? [] : [{ sku: l.sku, kg: l.kg }]));
  return decideStatus(ex, computeQuote(priced, null, fxError), fxError);
};

// The agent error row is decided in assemble(); see assemble.test.ts.
describe("decideStatus: one rule at a time", () => {
  it("unclear quantity → needs_info with a question", () => {
    expect(decide(extraction({ lines: [line("KV-ESP-02", null)] }))).toEqual({
      status: "needs_info",
      reasons: ["Quantity unclear for Single Origin Ethiopia"],
      questions: ["How many kg of Single Origin Ethiopia would you like?"],
    });
  });

  it("below minimum → needs_info with a question", () => {
    expect(decide(extraction({ lines: [line("KV-ESP-01", 25), line("KV-CLD-01", 8)] }))).toEqual({
      status: "needs_info",
      reasons: ["Cold Brew Blend: 8 kg is below the 10 kg minimum"],
      questions: ["The minimum for Cold Brew Blend is 10 kg. Would that work?"],
    });
  });

  it("not in catalog → needs_info with a question", () => {
    expect(decide(extraction({ lines: [line("KV-FIL-01", 20)], notInCatalog: ["Kenya AA"] }))).toEqual({
      status: "needs_info",
      reasons: ['"Kenya AA" is not in our catalog'],
      questions: ["We don't sell Kenya AA. Would one of our other coffees work?"],
    });
  });

  it("no lines and nothing else → needs_info, no product identified", () => {
    expect(decide(extraction())).toEqual({
      status: "needs_info",
      reasons: ["No product identified"],
      questions: ["Which coffees would you like to order?"],
    });
  });

  it("doesn't say no product when an unsold item explains the empty order", () => {
    expect(decide(extraction({ notInCatalog: ["Kenya AA"] })).reasons).toEqual(['"Kenya AA" is not in our catalog']);
  });

  it("model questions → needs_info with the model's questions", () => {
    const questions = ["Is the delivery to the Södermalm address?"];
    expect(decide(extraction({ lines: [line("KV-ESP-01", 20)], questions }))).toEqual({
      status: "needs_info", reasons: ["The agent has open questions"], questions,
    });
  });

  it("asked for more than the standard discount → needs_approval", () => {
    expect(decide(extraction({ lines: [line("KV-ESP-01", 120)], requestedDiscountPct: 15 }))).toEqual({
      status: "needs_approval", reasons: ["Asked for 15%; standard is 10%. Quote uses 10%"], questions: [],
    });
  });

  it("over 50,000 SEK after discount → needs_approval", () => {
    expect(decide(extraction({ lines: [line("KV-ESP-02", 180)] }))).toEqual({
      status: "needs_approval",
      reasons: [`${formatSek(50220)} after discount is above the ${formatSek(50000)} limit`],
      questions: [],
    });
  });

  it("FX failure keeps ready_for_review and adds its reason", () => {
    expect(decide(extraction({ currency: "EUR", lines: [line("KV-ORG-01", 30)] }), "timeout")).toEqual({
      status: "ready_for_review", reasons: ["Exchange rate lookup failed; quote kept in SEK"], questions: [],
    });
  });

  it("nothing fired → ready_for_review", () => {
    expect(decide(extraction({ lines: [line("KV-ESP-01", 20)] }))).toEqual({
      status: "ready_for_review", reasons: ["All pricing rules met"], questions: [],
    });
  });
});

describe("decideStatus: precedence and boundaries", () => {
  it("below minimum plus over 50,000 → needs_info with both reasons", () => {
    const result = decide(extraction({ lines: [line("KV-ESP-02", 180), line("KV-CLD-01", 8)] }));
    expect(result.status).toBe("needs_info");
    expect(result.reasons).toEqual([
      "Cold Brew Blend: 8 kg is below the 10 kg minimum",
      `${formatSek(51804)} after discount is above the ${formatSek(50000)} limit`,
    ]);
  });

  it("asked 10% on 120 kg → no approval, it's the standard tier", () => {
    expect(decide(extraction({ lines: [line("KV-ESP-01", 120)], requestedDiscountPct: 10 })).status).toBe("ready_for_review");
  });

  it("exactly 50,000 SEK → no approval; 50,001 → approval", () => {
    const ex = extraction({ lines: [line("KV-ESP-01", 20)] });
    const quote = computeQuote([{ sku: "KV-ESP-01", kg: 20 }], null, null);
    expect(decideStatus(ex, { ...quote, goodsAfterDiscountSek: 50_000 }, null).status).toBe("ready_for_review");
    expect(decideStatus(ex, { ...quote, goodsAfterDiscountSek: 50_001 }, null).status).toBe("needs_approval");
  });
});
