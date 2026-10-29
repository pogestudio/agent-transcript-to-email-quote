import { findProduct } from "./catalog";
import type { Fx, Quote, QuoteLine } from "./types";

export const APPROVAL_LIMIT_SEK = 50_000;
export const VAT_RATE = 0.25;                             // case data; see Assumptions
export const discountPct = (kg: number) => (kg >= 100 ? 10 : kg >= 50 ? 5 : 0);
export const deliverySek = (kg: number) => (kg >= 30 ? 0 : 250);
// SEK to the customer's currency, rounded to the cent. Each amount is converted on its own.
export const convertSek = (sek: number, rate: number) => Math.round(sek * rate * 100) / 100;

export function priceLine(sku: string, kg: number): QuoteLine {
  const product = findProduct(sku);
  if (!product) throw new Error(`Unknown SKU: ${sku}`);
  if (!Number.isInteger(kg) || kg < 1) throw new Error(`kg must be a whole number of at least 1, got ${kg}`);
  return {
    sku, name: product.name, kg, unitPriceSek: product.priceSek, lineSek: product.priceSek * kg,
    minKg: product.minKg, belowMin: kg < product.minKg,
  };
}

// discountOverridePct is a manager's decision and replaces the volume tier. The agent never sets it.
export function computeQuote(
  lines: { sku: string; kg: number }[],
  fx: Fx | null,
  fxError: string | null,
  discountOverridePct: number | null = null,
): Quote {
  const quoteLines = lines.map((l) => priceLine(l.sku, l.kg));
  const totalKg = quoteLines.reduce((sum, l) => sum + l.kg, 0);
  const subtotalSek = quoteLines.reduce((sum, l) => sum + l.lineSek, 0);
  const pct = discountOverridePct ?? discountPct(totalKg);
  const discountSek = Math.floor((subtotalSek * pct + 50) / 100);   // whole kronor, rounded half up
  const goodsAfterDiscountSek = subtotalSek - discountSek;
  const delivery = quoteLines.length === 0 ? 0 : deliverySek(totalKg);
  const totalExclVatSek = goodsAfterDiscountSek + delivery;
  const vatSek = totalExclVatSek * VAT_RATE;
  const totalInclVatSek = totalExclVatSek + vatSek;
  return {
    lines: quoteLines, totalKg, subtotalSek, discountPct: pct, discountSek, goodsAfterDiscountSek,
    deliverySek: delivery, totalExclVatSek, vatSek, totalInclVatSek,
    fx: fx ? { ...fx, totalExclVat: convertSek(totalExclVatSek, fx.rate),
               totalInclVat: convertSek(totalInclVatSek, fx.rate) } : null,
    fxError,
  };
}
