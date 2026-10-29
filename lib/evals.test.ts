import { describe, expect, it } from "vitest";
import { assemble } from "./assemble";
import { grade, summarize, type EvalCase, type EvalResult } from "./evals";
import type { Extraction, Fx, Run } from "./types";

const extraction = (fields: Partial<Extraction> = {}): Extraction => ({
  customer: "Café Linnea", currency: "SEK", lines: [], notInCatalog: [],
  requestedDiscountPct: null, questions: [], deliveryNote: null, ...fields,
});
const line = (sku: string, kg: number | null) => ({ sku, kg, evidence: "" });

// A run as runAgent saves it: the model's extraction through the real assemble().
const run = (x: Extraction, fx: Fx | null = null): Run => ({
  id: "r_1", createdAt: "2026-10-29T18:00:00.000Z", source: "eval", transcript: "", customer: x.customer,
  fxFail: false, promptVersion: "v1", memoryUsed: [], extraction: x, ...assemble(x, fx, null, null), error: null,
  totals: { steps: 3, inputTokens: 5000, outputTokens: 400, costUsd: 0.014, ms: 5000 },
});

const EUR: Fx = { currency: "EUR", rate: 0.090913, rateDate: "2026-10-28", fetchedAt: "2026-10-29T18:00:00.000Z",
  source: "Frankfurter (ECB reference rates)" };

const TC01: EvalCase["expected"] = { lines: [{ sku: "KV-ESP-01", kg: 20 }], totalExclVatSek: 5050,
  status: "ready_for_review", currency: "SEK" };
const TC04: EvalCase["expected"] = { lines: [{ sku: "KV-ESP-01", kg: 120 }], totalExclVatSek: 25920,
  status: "needs_approval", currency: "SEK" };
const TC07: EvalCase["expected"] = { lines: [{ sku: "KV-FIL-01", kg: 40 }, { sku: "KV-ESP-02", kg: 20 }],
  totalExclVatSek: 13870, status: "ready_for_review", currency: "EUR" };

describe("grade", () => {
  it("passes a perfect run", () => {
    expect(grade(TC01, run(extraction({ lines: [line("KV-ESP-01", 20)] })))).toEqual({
      pass: true, lines: true, total: true, status: true, currency: true, questions: true, invented: 0,
      overEscalated: false, underEscalated: false, blocked: 0, failed: [],
    });
  });

  it("fails lines and total on a wrong kg", () => {
    const g = grade(TC01, run(extraction({ lines: [line("KV-ESP-01", 25)] })));
    expect(g).toMatchObject({ pass: false, lines: false, total: false, status: true });
    expect(g.failed).toEqual(["lines", "total"]);
  });

  it("counts an over escalation: expected ready_for_review, got needs_info", () => {
    const x = extraction({ lines: [line("KV-ESP-01", 20)], questions: ["Which day suits you?"] });
    expect(grade(TC01, run(x))).toMatchObject({ pass: false, status: false, overEscalated: true, underEscalated: false });
  });

  it("counts an under escalation: expected needs_approval, got ready_for_review", () => {
    // The model missed the 15% request, so nothing escalates.
    const x = extraction({ lines: [line("KV-ESP-01", 120)], requestedDiscountPct: null });
    expect(grade(TC04, run(x))).toMatchObject({ pass: false, status: false, overEscalated: false, underEscalated: true });
  });

  it("fails currency when a EUR quote comes out in SEK, and passes it with the rate", () => {
    const lines = [line("KV-FIL-01", 40), line("KV-ESP-02", 20)];
    expect(grade(TC07, run(extraction({ lines })))).toMatchObject({ pass: false, currency: false, failed: ["currency"] });
    expect(grade(TC07, run(extraction({ lines, currency: "EUR" }), EUR))).toMatchObject({ pass: true, currency: true });
  });

  it("fails questions when the model repeats the minimum question the system already asks", () => {
    const TC10: EvalCase["expected"] = { lines: [{ sku: "KV-ESP-01", kg: 25 }, { sku: "KV-CLD-01", kg: 8 }],
      totalExclVatSek: 7760, status: "needs_info", currency: "SEK" };
    const lines = [line("KV-ESP-01", 25), line("KV-CLD-01", 8)];
    const asked = extraction({ lines, questions: ["The minimum for Cold Brew Blend is 10 kg. Would you like 10 kg?"] });
    // needs_info either way, so only the questions check sees it.
    expect(grade(TC10, run(asked))).toMatchObject({ pass: false, status: true, questions: false, failed: ["questions"] });
    expect(grade(TC10, run(extraction({ lines })))).toMatchObject({ pass: true, questions: true });
  });

  it.each([
    ["a non catalog SKU", { sku: "KV-KEN-01" }],
    ["a price that differs from the catalog", { unitPriceSek: 100 }],
  ])("counts an invented line with %s", (_, change) => {
    const r = run(extraction({ lines: [line("KV-ESP-01", 20)] }));
    r.quote.lines[0] = { ...r.quote.lines[0], ...change };
    expect(grade(TC01, r)).toMatchObject({ pass: false, invented: 1, failed: ["invented"] });
  });
});

describe("summarize", () => {
  const result = (caseId: string, pass: boolean, costUsd: number, ms: number): EvalResult => ({
    caseId, runId: `r_${caseId}_${ms}`, costUsd, ms, pass, lines: pass, total: pass, status: true, currency: true,
    questions: true, invented: 0, overEscalated: false, underEscalated: false, blocked: 0, failed: pass ? [] : ["lines", "total"],
  });

  it("counts pass^k only for cases where all k runs passed, with cost and latency ranges", () => {
    const s = summarize([
      result("TC01", true, 0.01, 4000), result("TC01", true, 0.012, 5000), result("TC01", true, 0.014, 6000),
      result("TC02", true, 0.009, 3000), result("TC02", false, 0.018, 12000), result("TC02", true, 0.011, 7000),
    ], 3);
    expect(s.passed).toEqual({ ok: 5, of: 6 });
    expect(s.passK).toEqual({ ok: 1, of: 2 });
    expect(s.costUsd.min).toBe(0.009);
    expect(s.costUsd.max).toBe(0.018);
    expect(s.costUsd.mean).toBeCloseTo(0.074 / 6);
    expect(s.ms).toEqual({ median: 5500, max: 12000 });
  });
});
