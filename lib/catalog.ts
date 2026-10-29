export type Product = { sku: string; name: string; priceSek: number; minKg: number; keywords: string[] };

export const CATALOG: Product[] = [
  { sku: "KV-ESP-01", name: "House Espresso", priceSek: 240, minKg: 5, keywords: ["espresso", "house"] },
  { sku: "KV-ESP-02", name: "Single Origin Ethiopia", priceSek: 310, minKg: 5, keywords: ["ethiopia", "ethiopian", "etiopien", "single origin"] },
  { sku: "KV-FIL-01", name: "Morning Filter", priceSek: 210, minKg: 5, keywords: ["morning", "filter", "bryggkaffe"] },
  { sku: "KV-FIL-02", name: "Colombia Decaf Filter", priceSek: 260, minKg: 5, keywords: ["decaf", "colombia", "colombian", "koffeinfritt", "filter"] },
  { sku: "KV-ORG-01", name: "Organic Breakfast Blend", priceSek: 230, minKg: 5, keywords: ["organic", "breakfast", "ekologisk", "eko"] },
  { sku: "KV-CLD-01", name: "Cold Brew Blend", priceSek: 220, minKg: 10, keywords: ["cold brew", "cold"] },
];

export const findProduct = (sku: string) => CATALOG.find((p) => p.sku === sku);
