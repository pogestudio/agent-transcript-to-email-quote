import { describe, expect, it } from "vitest";
import { assemble } from "./assemble";
import { formatSek } from "./format";
import type { Extraction } from "./types";

const extraction = (fields: Partial<Extraction> = {}): Extraction => ({
  customer: "Café Linnea", currency: "SEK", lines: [], notInCatalog: [],
  requestedDiscountPct: null, questions: [], deliveryNote: null, ...fields,
});
const line = (sku: string, kg: number | null) => ({ sku, kg, evidence: "" });

describe("assemble", () => {
  it("turns the TC01 extraction into 5,050 SEK, ready_for_review and the email", () => {
    const out = assemble(extraction({ lines: [line("KV-ESP-01", 20)] }), null, null, null);
    expect(out.quote?.totalExclVatSek).toBe(5050);
    expect(out.status).toBe("ready_for_review");
    expect(out.email).toContain(`Total excl. VAT: ${formatSek(5050)}`);
    expect(out.blockedSkus).toEqual([]);
  });

  it("blocks an unknown SKU and asks about it", () => {
    const out = assemble(extraction({ lines: [line("KV-KEN-01", 10), line("KV-FIL-01", 20)] }), null, null, null);
    expect(out.blockedSkus).toEqual(["KV-KEN-01"]);
    expect(out.quote?.lines.map((l) => l.sku)).toEqual(["KV-FIL-01"]);
    expect(out.status).toBe("needs_info");
    expect(out.reasons).toEqual(['"KV-KEN-01 (unknown code)" is not in our catalog']);
    expect(out.email).toContain("We don't sell KV-KEN-01 (unknown code).");
  });

  it("leaves a kg: null line out of the quote and asks for the quantity", () => {
    const out = assemble(extraction({ lines: [line("KV-ESP-01", 20), line("KV-ESP-02", null)] }), null, null, null);
    expect(out.quote?.lines.map((l) => l.sku)).toEqual(["KV-ESP-01"]);
    expect(out.quote?.totalExclVatSek).toBe(5050);
    expect(out.status).toBe("needs_info");
    expect(out.questions).toEqual(["How many kg of Single Origin Ethiopia would you like?"]);
  });

  it("prices nothing when every quantity is unclear (TC05)", () => {
    const out = assemble(extraction({ lines: [line("KV-ESP-02", null)] }), null, null, null);
    expect(out.quote).toMatchObject({ lines: [], totalExclVatSek: 0 });
    expect(out.status).toBe("needs_info");
  });

  it("returns needs_info with the agent error when there is no extraction", () => {
    expect(assemble(null, null, null, "step limit (10) reached")).toEqual({
      quote: null, status: "needs_info", questions: [], email: "", blockedSkus: [],
      reasons: ["Agent could not finish: step limit (10) reached. See the trace"],
    });
  });
});
