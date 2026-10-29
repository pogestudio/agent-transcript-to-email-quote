import { buildEmail } from "./email";
import { computeQuote } from "./pricing";
import { appendJsonl, newId, writeJson } from "./store";
import type { Extraction, Run, TraceEvent } from "./types";

export type RunInput = { transcript: string; customer: string | null; fxFail: boolean; parentId?: string };

// Fake until Phase 4: every transcript gets the same TC01 answer, saved as a run with a 3 event trace.
const MODEL = "claude-sonnet-5-5";
const CANNED_LINE = { sku: "KV-ESP-01", kg: 20, evidence: "Twenty kilo. Tjugo." };
const CANNED_USAGE = { input_tokens: 1800, output_tokens: 220 };
const CANNED_MS = { llm: 1650, tool: 1 };

export async function runAgent(input: RunInput): Promise<Run> {
  const id = newId();
  const extraction: Extraction = {
    customer: input.customer, currency: "SEK", lines: [CANNED_LINE],
    notInCatalog: [], requestedDiscountPct: null, questions: [], deliveryNote: null,
  };
  const quote = computeQuote([{ sku: CANNED_LINE.sku, kg: CANNED_LINE.kg }], null, null);
  const priced = quote.lines[0];
  const totals = {
    steps: 1,
    inputTokens: CANNED_USAGE.input_tokens,
    outputTokens: CANNED_USAGE.output_tokens,
    costUsd: (CANNED_USAGE.input_tokens * 2 + CANNED_USAGE.output_tokens * 10) / 1_000_000,
    ms: CANNED_MS.llm + CANNED_MS.tool,
  };

  const run: Run = {
    id, createdAt: new Date().toISOString(), source: "ui", ...input,
    promptVersion: "v1", memoryUsed: [], extraction, blockedSkus: [], quote,
    status: "ready_for_review", reasons: ["All pricing rules met"], questions: [],
    email: buildEmail({ customer: input.customer, quote, status: "ready_for_review", questions: [],
      notInCatalog: [], deliveryNote: null }),
    error: null, totals,
  };

  const event = (kind: TraceEvent["kind"], fields: Record<string, unknown>): TraceEvent =>
    ({ runId: id, ts: new Date().toISOString(), step: 1, kind, ...fields });
  const trace = [
    event("llm", { model: MODEL, usage: CANNED_USAGE, ms: CANNED_MS.llm, stopReason: "tool_use" }),
    event("tool", { name: "price_line", input: { sku: priced.sku, kg: priced.kg }, output: priced,
      ms: CANNED_MS.tool, isError: false }),
    event("end", { status: run.status, reasons: run.reasons, totals }),
  ];

  for (const e of trace) appendJsonl(`traces/${id}.jsonl`, e);
  writeJson(`runs/${id}.json`, run);
  return run;
}
