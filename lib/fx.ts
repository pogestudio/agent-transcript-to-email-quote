import type { Fx } from "./types";

export const FX_URL = "https://api.frankfurter.dev/v1/latest";
export const FX_TIMEOUT_MS = 5000;
export const FX_SOURCE = "Frankfurter (ECB reference rates)";

export type RateResult = ({ ok: true } & Fx) | { ok: false; error: string };
export type FxContext = { fxFail: boolean; fxCache: Map<string, RateResult> };

// Cached per run, success or failure, so the quote uses exactly the result the model saw.
export async function getRate(currency: string, ctx: FxContext): Promise<RateResult> {
  const cur = currency.trim().toUpperCase();
  const cached = ctx.fxCache.get(cur);
  if (cached) return cached;
  const result = await fetchRate(cur, ctx.fxFail);
  ctx.fxCache.set(cur, result);
  return result;
}

// Fails closed: no rate gives an error, never a guessed number.
async function fetchRate(cur: string, fxFail: boolean): Promise<RateResult> {
  if (fxFail) return { ok: false, error: "Exchange rate lookup failed (simulated)" };
  if (!/^[A-Z]{3}$/.test(cur)) return { ok: false, error: `"${cur}" is not a 3 letter ISO 4217 code` };  // model text never reaches the URL
  try {
    const res = await fetch(`${FX_URL}?base=SEK&symbols=${cur}`, { signal: AbortSignal.timeout(FX_TIMEOUT_MS) });
    if (!res.ok) return { ok: false, error: `Frankfurter returned HTTP ${res.status}` };
    const body = (await res.json()) as { date?: unknown; rates?: Record<string, unknown> };
    const rate = body.rates?.[cur];
    if (typeof rate !== "number" || !(rate > 0) || typeof body.date !== "string") {
      return { ok: false, error: `Frankfurter has no rate for ${cur}` };
    }
    return { ok: true, currency: cur, rate, rateDate: body.date, fetchedAt: new Date().toISOString(), source: FX_SOURCE };
  } catch (e) {
    return { ok: false, error: `Exchange rate lookup failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}
