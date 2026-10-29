import { runAgent } from "./agent";
import { findProduct } from "./catalog";
import { listJson, newId, readJson, readTranscript, writeJson } from "./store";
import type { Run, Status } from "./types";

// One case in data/expected.json.
export type EvalCase = {
  id: string; transcript: string; customer: string; fxFail: boolean; scenario: string;
  expected: { lines: { sku: string; kg: number | null }[]; totalExclVatSek: number | null; status: Status; currency: string };
};

export type Grade = {
  pass: boolean;                          // lines, total, status and currency pass, and invented is 0
  lines: boolean;
  total: boolean | null;                  // null: skipped, the expected total is null
  status: boolean;
  currency: boolean;
  invented: number;                       // quote lines with a non catalog SKU or price
  overEscalated: boolean;                 // expected ready_for_review, got an escalation
  underEscalated: boolean;                // expected an escalation, got ready_for_review
  blocked: number;                        // unknown SKUs code removed; reported, not a failure
  failed: string[];                       // names of the failed checks
};

export type EvalResult = Grade & { caseId: string; runId: string; costUsd: number; ms: number };

export type EvalBatch = {
  batch: string; promptVersion: string; k: number; status: "running" | "done";
  startedAt: string; finishedAt?: string; results: EvalResult[];
};
export type BatchInfo = Omit<EvalBatch, "results"> & { runsDone: number };

export type Tally = { ok: number; of: number };
export type CaseSummary = { caseId: string; results: EvalResult[]; lines: Tally; total: Tally; status: Tally };
export type Summary = {
  passed: Tally;                          // runs
  passK: Tally;                           // cases where all k runs passed
  lines: Tally; total: Tally; status: Tally;
  overEscalated: number; underEscalated: number; invented: number; blocked: number;
  costUsd: { mean: number; min: number; max: number };
  ms: { median: number; max: number };
  cases: CaseSummary[];
};

export const DEFAULT_K = 3;
export const MAX_K = 5;
export const MAX_PARALLEL = 3;

const BATCH_ID = /^b_\w+$/;

export const loadCases = () => readJson<EvalCase[]>("expected.json") ?? [];

export const readBatch = (id: string) => (BATCH_ID.test(id) ? readJson<EvalBatch>(`evals/${id}.json`) : null);

// Newest first, without the results.
export const listBatches = (): BatchInfo[] =>
  listJson<EvalBatch>("evals")
    .map(({ results, ...info }) => ({ ...info, runsDone: results.length }))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

// "KV-ESP-01:20", or "KV-ESP-02:?" for an unclear quantity. Sorted, so the order doesn't matter
// but a duplicated line does.
const lineKeys = (lines: { sku: string; kg: number | null }[]) =>
  lines.map((l) => `${l.sku}:${l.kg ?? "?"}`).sort().join(", ");

// Every check is code: each graded outcome has an exact answer.
export function grade(expected: EvalCase["expected"], run: Run): Grade {
  // The model's lines after code removed unknown SKUs: what the quote was built from.
  const read = (run.extraction?.lines ?? []).filter((l) => !run.blockedSkus.includes(l.sku));
  const lines = lineKeys(read) === lineKeys(expected.lines);
  const total = expected.totalExclVatSek === null ? null : run.quote?.totalExclVatSek === expected.totalExclVatSek;
  const status = run.status === expected.status;
  // The quote's currency, not the model's: SEK when the rate lookup failed.
  const fx = run.quote?.fx ?? null;
  const currency = run.quote !== null && (fx?.currency ?? "SEK") === expected.currency &&
    (fx === null || Boolean(fx.rate && fx.rateDate && fx.fetchedAt));
  const invented = (run.quote?.lines ?? []).filter((l) => findProduct(l.sku)?.priceSek !== l.unitPriceSek).length;
  const escalated = run.status !== "ready_for_review";
  const shouldEscalate = expected.status !== "ready_for_review";
  const checks: [string, boolean][] = [
    ["lines", lines], ["total", total !== false], ["status", status], ["currency", currency], ["invented", invented === 0],
  ];
  const failed = checks.flatMap(([name, ok]) => (ok ? [] : [name]));
  return {
    pass: failed.length === 0, lines, total, status, currency, invented,
    overEscalated: !shouldEscalate && escalated, underEscalated: shouldEscalate && !escalated,
    blocked: run.blockedSkus.length, failed,
  };
}

const tally = (checks: (boolean | null)[]): Tally => {
  const graded = checks.filter((c) => c !== null);
  return { ok: graded.filter(Boolean).length, of: graded.length };
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const sorted = [...xs].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function summarize(results: EvalResult[], k: number): Summary {
  const cases = [...new Set(results.map((r) => r.caseId))].map((caseId) => {
    const runs = results.filter((r) => r.caseId === caseId);
    return {
      caseId, results: runs,
      lines: tally(runs.map((r) => r.lines)), total: tally(runs.map((r) => r.total)), status: tally(runs.map((r) => r.status)),
    };
  });
  const count = (pick: (r: EvalResult) => number | boolean) => sum(results.map((r) => Number(pick(r))));
  const cost = results.map((r) => r.costUsd), ms = results.map((r) => r.ms);
  return {
    passed: tally(results.map((r) => r.pass)),
    // A customer gets one quote, so a case counts only when all k of its runs passed.
    passK: tally(cases.map((c) => c.results.length >= k && c.results.every((r) => r.pass))),
    lines: tally(results.map((r) => r.lines)),
    total: tally(results.map((r) => r.total)),
    status: tally(results.map((r) => r.status)),
    overEscalated: count((r) => r.overEscalated),
    underEscalated: count((r) => r.underEscalated),
    invented: count((r) => r.invented),
    blocked: count((r) => r.blocked),
    costUsd: {
      mean: cost.length ? sum(cost) / cost.length : 0,
      min: cost.length ? Math.min(...cost) : 0,
      max: cost.length ? Math.max(...cost) : 0,
    },
    ms: { median: median(ms), max: ms.length ? Math.max(...ms) : 0 },
    cases,
  };
}

// Writes data/evals/<batch>.json, then runs every case k times, at most MAX_PARALLEL at a time,
// and rewrites the file after each run. Returns at once; `done` settles when the batch is finished.
export function runSuite(promptVersion: string, k: number): { batch: string; done: Promise<EvalBatch> } {
  const batch = newId("b"), file = `evals/${batch}.json`;
  const state: EvalBatch = { batch, promptVersion, k, status: "running", startedAt: new Date().toISOString(), results: [] };
  writeJson(file, state);

  const jobs = loadCases().flatMap((c) => Array.from({ length: k }, () => c));
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const c = jobs[next++];
      const run = await runAgent({
        transcript: readTranscript(c.transcript) ?? "", customer: c.customer, fxFail: c.fxFail,
        source: "eval", promptVersion, batch, caseId: c.id,
      });
      state.results.push({ caseId: c.id, runId: run.id, ...grade(c.expected, run), costUsd: run.totals.costUsd, ms: run.totals.ms });
      writeJson(file, state);
    }
  };
  const done = Promise.all(Array.from({ length: MAX_PARALLEL }, worker)).then(() => {
    state.status = "done";
    state.finishedAt = new Date().toISOString();
    writeJson(file, state);
    return state;
  });
  return { batch, done };
}
