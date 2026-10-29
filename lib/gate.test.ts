import { describe, expect, it } from "vitest";
import type { EvalBatch, EvalResult } from "./evals";
import { gate } from "./gate";

// One graded run. Only pass, invented and underEscalated matter to the gate.
const result = (caseId: string, pass: boolean, fields: Partial<EvalResult> = {}): EvalResult => ({
  caseId, runId: "r_1", pass, lines: pass, total: pass, status: pass, currency: true, questions: true, invented: 0,
  overEscalated: false, underEscalated: false, blocked: 0, failed: pass ? [] : ["lines"], costUsd: 0.014, ms: 5000,
  ...fields,
});
// k = 3 runs per case: "TC01: 3" is three passes, "TC11: 0" three failures.
const batch = (passes: Record<string, number>): EvalBatch => ({
  batch: "b_1", promptVersion: "v1", k: 3, status: "done", startedAt: "2026-10-29T18:00:00.000Z",
  results: Object.entries(passes).flatMap(([id, n]) => [0, 1, 2].map((i) => result(id, i < n))),
});

const V1 = batch({ TC01: 3, TC06: 3, TC11: 0 });

describe("gate", () => {
  it("passes when the target improved and nothing else changed", () => {
    expect(gate(V1, batch({ TC01: 3, TC06: 3, TC11: 3 }), ["TC11"])).toEqual({
      ok: true, dropped: [], notImproved: [], invented: 0, reasons: [],
    });
  });

  it("blocks when one case drops", () => {
    const g = gate(V1, batch({ TC01: 3, TC06: 2, TC11: 3 }), ["TC11"]);
    expect(g).toMatchObject({ ok: false, dropped: ["TC06"] });
    expect(g.reasons).toEqual(["TC06 dropped from 3/3 to 2/3"]);
  });

  it("blocks when a target did not improve", () => {
    const g = gate(V1, batch({ TC01: 3, TC06: 3, TC11: 0 }), ["TC11"]);
    expect(g).toMatchObject({ ok: false, notImproved: ["TC11"] });
    expect(g.reasons).toEqual(["TC11 did not improve (0/3 to 0/3)"]);
  });

  it("blocks on any invented line", () => {
    const candidate = batch({ TC01: 3, TC06: 3, TC11: 3 });
    candidate.results[0].invented = 1;
    const g = gate(V1, candidate, ["TC11"]);
    expect(g).toMatchObject({ ok: false, invented: 1 });
    expect(g.reasons).toEqual(["1 invented line"]);
  });

  it("blocks when under escalations rise", () => {
    // TC04 fails all 3 runs in both batches; in the candidate one of them also missed the escalation.
    const baseline = batch({ TC01: 3, TC04: 0, TC11: 0 }), candidate = batch({ TC01: 3, TC04: 0, TC11: 3 });
    candidate.results.find((r) => r.caseId === "TC04")!.underEscalated = true;
    const g = gate(baseline, candidate, ["TC11"]);
    expect(g.ok).toBe(false);
    expect(g.reasons).toEqual(["Under escalations rose from 0 to 1"]);
  });
});
