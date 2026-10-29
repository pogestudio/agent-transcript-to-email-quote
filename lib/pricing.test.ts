import { describe, expect, it } from "vitest";
import { computeQuote, deliverySek, discountPct, priceLine } from "./pricing";
import type { Fx } from "./types";

const EUR: Fx = {
  currency: "EUR", rate: 0.0871, rateDate: "2026-10-28", fetchedAt: "2026-10-29T09:14:03.412Z",
  source: "Frankfurter (ECB reference rates)",
};

// The Phase 5 answer key: every case with an expected total (TC05 has none).
const CASES = [
  { id: "TC01", lines: [{ sku: "KV-ESP-01", kg: 20 }], total: 5050 },
  { id: "TC02", lines: [{ sku: "KV-ESP-01", kg: 60 }, { sku: "KV-ORG-01", kg: 40 }], total: 21240 },
  { id: "TC03", lines: [{ sku: "KV-FIL-01", kg: 20 }], total: 4450 },
  { id: "TC04", lines: [{ sku: "KV-ESP-01", kg: 120 }], total: 25920 },
  { id: "TC06", lines: [{ sku: "KV-FIL-02", kg: 60 }], total: 14820 },
  { id: "TC07", lines: [{ sku: "KV-FIL-01", kg: 40 }, { sku: "KV-ESP-02", kg: 20 }], total: 13870 },
  { id: "TC08", lines: [{ sku: "KV-ORG-01", kg: 30 }], total: 6900 },
  { id: "TC09", lines: [{ sku: "KV-ESP-02", kg: 180 }], total: 50220 },
  { id: "TC10", lines: [{ sku: "KV-ESP-01", kg: 25 }, { sku: "KV-CLD-01", kg: 8 }], total: 7760 },
];
const linesOf = (id: string) => CASES.find((c) => c.id === id)!.lines;

describe("priceLine", () => {
  it("prices a known SKU from the catalog", () => {
    expect(priceLine("KV-ESP-01", 20)).toEqual({
      sku: "KV-ESP-01", name: "House Espresso", kg: 20, unitPriceSek: 240, lineSek: 4800, minKg: 5, belowMin: false,
    });
  });

  it("throws on an unknown SKU", () => {
    expect(() => priceLine("KV-KEN-01", 20)).toThrow("Unknown SKU");
  });

  it("throws when kg is not a whole number of at least 1", () => {
    expect(() => priceLine("KV-ESP-01", 0)).toThrow();
    expect(() => priceLine("KV-ESP-01", 2.5)).toThrow();
  });

  it("flags Cold Brew at 8 kg as below its 10 kg minimum", () => {
    expect(priceLine("KV-CLD-01", 8)).toMatchObject({ lineSek: 1760, minKg: 10, belowMin: true });
  });
});

describe("volume rules", () => {
  it.each([[49, 0], [50, 5], [99, 5], [100, 10]])("discountPct(%i kg) is %i%%", (kg, pct) => {
    expect(discountPct(kg)).toBe(pct);
  });

  it.each([[29, 250], [30, 0]])("deliverySek(%i kg) is %i", (kg, sek) => {
    expect(deliverySek(kg)).toBe(sek);
  });
});

describe("computeQuote", () => {
  it("rounds 5% of 15,810 SEK half up to 791", () => {
    const quote = computeQuote([{ sku: "KV-ESP-02", kg: 51 }], null, null);
    expect(quote).toMatchObject({ subtotalSek: 15810, discountPct: 5, discountSek: 791, goodsAfterDiscountSek: 15019 });
  });

  it("applies a 15% manager override on 120 kg House Espresso", () => {
    const quote = computeQuote([{ sku: "KV-ESP-01", kg: 120 }], null, null, 15);
    expect(quote).toMatchObject({ discountPct: 15, discountSek: 4320, totalExclVatSek: 24480 });
  });

  it.each(CASES)("$id totals $total SEK excl. VAT", ({ lines, total }) => {
    expect(computeQuote(lines, null, null).totalExclVatSek).toBe(total);
  });

  it("adds 25% VAT exactly", () => {
    const quote = computeQuote([{ sku: "KV-ESP-01", kg: 20 }], null, null);
    expect(quote).toMatchObject({ vatSek: 1262.5, totalInclVatSek: 6312.5 });
  });

  it("converts the totals at the rate, rounded to 2 decimals", () => {
    const quote = computeQuote(linesOf("TC07"), EUR, null);
    expect(quote.fx).toEqual({ ...EUR, totalExclVat: 1208.08, totalInclVat: 1510.1 });
    expect(quote.fxError).toBeNull();
  });

  it("keeps SEK and the error when the rate couldn't be fetched", () => {
    const quote = computeQuote(linesOf("TC08"), null, "timeout");
    expect(quote).toMatchObject({ fx: null, fxError: "timeout", totalExclVatSek: 6900 });
  });

  it("charges no delivery when there are no lines", () => {
    expect(computeQuote([], null, null)).toMatchObject({ deliverySek: 0, totalExclVatSek: 0, totalInclVatSek: 0 });
  });
});
