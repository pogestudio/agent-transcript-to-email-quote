import { afterEach, describe, expect, it, vi } from "vitest";
import { FX_SOURCE, FX_URL, type RateResult } from "./fx";
import { makeTools } from "./tools";

const tools = (fxFail = false) => makeTools({ fxFail, fxCache: new Map<string, RateResult>() });
const skus = (out: object) => (out as { sku: string }[]).map((p) => p.sku);

// The shape Frankfurter returned on build day for base=SEK&symbols=EUR.
const EUR_BODY = { amount: 1.0, base: "SEK", date: "2026-10-28", rates: { EUR: 0.090913 } };
const respond = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });
const mockFetch = (impl: () => Promise<Response>) => {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("makeTools", () => {
  it("returns an error for an unknown tool", async () => {
    expect(await tools().call("send_email", {})).toEqual({ error: "Unknown tool: send_email" });
  });
});

describe("search_products", () => {
  it("finds the decaf, without a price", async () => {
    expect(await tools().call("search_products", { query: "decaf" }))
      .toEqual([{ sku: "KV-FIL-02", name: "Colombia Decaf Filter", minKg: 5 }]);
  });

  it.each([
    ["filter", ["KV-FIL-01", "KV-FIL-02"]],
    ["Etiopien", ["KV-ESP-02"]],
    ["Kenya AA", []],
  ])('"%s" finds %j', async (query, expected) => {
    expect(skus(await tools().call("search_products", { query }))).toEqual(expected);
  });

  it("returns an error when the query is missing", async () => {
    expect(await tools().call("search_products", {})).toEqual({ error: "query must be a string" });
  });
});

describe("price_line", () => {
  it("prices a valid line from the catalog", async () => {
    expect(await tools().call("price_line", { sku: "KV-ESP-01", kg: 20 })).toEqual({
      sku: "KV-ESP-01", name: "House Espresso", kg: 20, unitPriceSek: 240, lineSek: 4800, minKg: 5, belowMin: false,
    });
  });

  it("returns an error for an unknown SKU", async () => {
    expect(await tools().call("price_line", { sku: "KV-KEN-01", kg: 20 })).toEqual({ error: "Unknown SKU: KV-KEN-01" });
  });

  it("returns an error for kg 0", async () => {
    expect(await tools().call("price_line", { sku: "KV-ESP-01", kg: 0 })).toHaveProperty("error");
  });
});

describe("convert_currency", () => {
  it("returns the same amount for SEK without a lookup", async () => {
    const fetch = mockFetch(respond(EUR_BODY));
    expect(await tools().call("convert_currency", { amount_sek: 5050, currency: "SEK" }))
      .toEqual({ ok: true, currency: "SEK", amount: 5050, rate: 1 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails on purpose when fxFail is set", async () => {
    const fetch = mockFetch(respond(EUR_BODY));
    expect(await tools(true).call("convert_currency", { amount_sek: 5050, currency: "EUR" }))
      .toEqual({ ok: false, error: "Exchange rate lookup failed (simulated)" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("converts at the live rate with the rate date and fetch time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-29T09:14:03.412Z"));
    const fetch = mockFetch(respond(EUR_BODY));
    expect(await tools().call("convert_currency", { amount_sek: 5050, currency: "EUR" })).toEqual({
      ok: true, currency: "EUR", amount: 459.11, rate: 0.090913, rateDate: "2026-10-28",
      fetchedAt: "2026-10-29T09:14:03.412Z", source: FX_SOURCE,
    });
    expect(fetch).toHaveBeenCalledWith(`${FX_URL}?base=SEK&symbols=EUR`, expect.anything());
  });

  it("fails closed with no rate when fetch rejects", async () => {
    mockFetch(async () => { throw new TypeError("fetch failed"); });
    expect(await tools().call("convert_currency", { amount_sek: 5050, currency: "EUR" }))
      .toEqual({ ok: false, error: "Exchange rate lookup failed: fetch failed" });
  });

  it("fails closed with no rate on HTTP 500", async () => {
    mockFetch(respond({ message: "server error" }, 500));
    expect(await tools().call("convert_currency", { amount_sek: 5050, currency: "EUR" }))
      .toEqual({ ok: false, error: "Frankfurter returned HTTP 500" });
  });

  it("looks the rate up once per run", async () => {
    const fetch = mockFetch(respond(EUR_BODY));
    const run = tools();
    await run.call("convert_currency", { amount_sek: 5050, currency: "EUR" });
    expect(await run.call("convert_currency", { amount_sek: 1000, currency: "EUR" }))
      .toMatchObject({ ok: true, amount: 90.91, rate: 0.090913 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
