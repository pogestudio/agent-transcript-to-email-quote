import { describe, expect, it } from "vitest";
import { findProduct } from "./catalog";
import { loadCases } from "./evals";
import { computeQuote } from "./pricing";
import { readTranscript } from "./store";
import type { Status } from "./types";

const STATUSES: Status[] = ["ready_for_review", "needs_approval", "needs_info"];

// Reads the real data/ folder: this checks our own answer key, not the code.
const CASES = loadCases();
const PRICED = CASES.filter((c) => c.expected.totalExclVatSek !== null);

describe("expected.json", () => {
  it("has at least 10 cases with unique ids and valid statuses", () => {
    const ids = CASES.map((c) => c.id);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CASES) expect(STATUSES).toContain(c.expected.status);
  });

  it.each(CASES)("$id has its transcript file $transcript", ({ transcript }) => {
    expect(readTranscript(transcript)).toBeTruthy();
  });

  it.each(CASES)("$id only expects catalog SKUs", ({ expected }) => {
    for (const line of expected.lines) expect(findProduct(line.sku), line.sku).toBeDefined();
  });

  it.each(PRICED)("$id totals $expected.totalExclVatSek SEK excl. VAT", ({ expected }) => {
    const lines = expected.lines as { sku: string; kg: number }[];
    expect(computeQuote(lines, null, null).totalExclVatSek).toBe(expected.totalExclVatSek);
  });
});
