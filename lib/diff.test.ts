import { describe, expect, it } from "vitest";
import { assemble } from "./assemble";
import { diffRuns } from "./diff";
import { formatSek } from "./format";
import type { Extraction, Memory, Run } from "./types";

const extraction = (fields: Partial<Extraction> = {}): Extraction => ({
  customer: "Bageri Kanel", currency: "SEK", lines: [], notInCatalog: [],
  requestedDiscountPct: null, questions: [], deliveryNote: null, ...fields,
});
const line = (sku: string, kg: number | null) => ({ sku, kg, evidence: "" });

// A run as runAgent saves it: the model's extraction through the real assemble().
const run = (x: Extraction, fields: Partial<Run> = {}): Run => ({
  id: "r_1", createdAt: "2026-10-29T18:00:00.000Z", source: "ui", transcript: "", customer: x.customer,
  fxFail: false, promptVersion: "v1", memoryUsed: [], extraction: x, ...assemble(x, null, null, null), error: null,
  totals: { steps: 3, inputTokens: 5000, outputTokens: 400, costUsd: 0.014, ms: 5000 }, ...fields,
});

const TUESDAY: Memory = {
  id: "m_1", note: "Always wants delivery on Tuesdays", createdAt: "2026-10-29T18:00:00.000Z",
  expiresAt: "2027-04-27T18:00:00.000Z", sourceRunId: "r_1",
};

describe("diffRuns", () => {
  it("finds no differences between two identical runs", () => {
    const x = extraction({ lines: [line("KV-ESP-02", 20)] });
    expect(diffRuns(run(x), run(x, { id: "r_2", parentId: "r_1" }))).toEqual([]);
  });

  it("finds the status, line and total changes of an answered question", () => {
    const parent = run(extraction({ lines: [line("KV-ESP-02", null)] }));
    const child = run(extraction({ lines: [line("KV-ESP-02", 20)] }), { id: "r_2", parentId: "r_1" });
    const changes = diffRuns(parent, child);
    expect(changes.map((c) => c.field)).toEqual(["Status", "Reasons", "Lines", "Total excl. VAT", "Email"]);
    expect(changes).toContainEqual({ field: "Status", before: "needs_info", after: "ready_for_review" });
    expect(changes).toContainEqual({ field: "Lines", before: "? kg KV-ESP-02", after: "20 kg KV-ESP-02" });
    expect(changes).toContainEqual({ field: "Total excl. VAT", before: "Not priced", after: formatSek(6450) });
  });

  it("finds the memory used and the email line it added", () => {
    const x = extraction({ customer: "Café Linnea", lines: [line("KV-ESP-01", 20)] });
    const parent = run(x);
    const child = run({ ...x, deliveryNote: "Delivery on Tuesday" }, { id: "r_2", parentId: "r_1", memoryUsed: [TUESDAY] });
    expect(diffRuns(parent, child)).toEqual([
      { field: "Memory used", before: "none", after: TUESDAY.note },
      { field: "Email", before: "none", after: "Delivery on Tuesday." },
    ]);
  });
});
