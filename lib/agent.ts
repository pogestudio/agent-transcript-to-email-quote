import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { assemble } from "./assemble";
import { getRate, type RateResult } from "./fx";
import { memoriesFor } from "./memory";
import { newId, writeJson } from "./store";
import { makeTools, TOOL_SCHEMAS } from "./tools";
import { Tracer } from "./trace";
import type { Extraction, Fx, Memory, Run } from "./types";

export type RunInput = {
  transcript: string; customer: string | null; fxFail: boolean; parentId?: string;
  source?: Run["source"]; promptVersion?: string; batch?: string; caseId?: string;
};

export const MODEL = "claude-sonnet-5-5";
export const MAX_STEPS = 10;
// The most the SDK accepts without streaming: it refuses requests it expects to take over 10 minutes.
export const MAX_TOKENS = 21_333;
// Not ANTHROPIC_API_KEY: Claude Code would pick that up from .env and bill it instead of the subscription.
export const API_KEY_VAR = "ANTHROPIC_AGENT_API_KEY";

const PROMPT_VERSION = /^v\d+$/;
const promptFile = (name: string) => path.join(process.cwd(), "prompts", name);

export const activePromptVersion = () => fs.readFileSync(promptFile("active.txt"), "utf8").trim();

// v1, v2, … from the prompts folder, in number order.
export const listPromptVersions = () =>
  fs.readdirSync(promptFile(""))
    .flatMap((name) => (name.endsWith(".md") && PROMPT_VERSION.test(name.slice(0, -3)) ? [name.slice(0, -3)] : []))
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

export function readPrompt(version: string): string {
  if (!PROMPT_VERSION.test(version)) throw new Error(`Unknown prompt version: ${version}`);
  return fs.readFileSync(promptFile(`${version}.md`), "utf8");
}

const isText = (v: unknown): v is string => typeof v === "string";
const isTextOrNull = (v: unknown) => v === null || isText(v);
const isTextList = (v: unknown): v is string[] => Array.isArray(v) && v.every(isText);
const isKg = (v: unknown) => v === null || (Number.isInteger(v) && (v as number) >= 1);

// The model's final answer: the text from the first { to the last }, checked against the Extraction
// contract. Only the contract's fields are kept, so the model has nowhere to put a price.
export function parseExtraction(text: string): Extraction | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const x = parsed as Record<string, unknown>;
  if (typeof x !== "object" || x === null || Array.isArray(x)) return null;
  const lines = x.lines as Record<string, unknown>[];
  const linesOk = Array.isArray(lines) && lines.every((l) =>
    typeof l === "object" && l !== null && isText(l.sku) && isKg(l.kg) && isText(l.evidence));
  const discountOk = x.requestedDiscountPct === null || typeof x.requestedDiscountPct === "number";
  if (!linesOk || !isTextOrNull(x.customer) || !isText(x.currency) || !isTextList(x.notInCatalog) ||
    !discountOk || !isTextList(x.questions) || !isTextOrNull(x.deliveryNote)) return null;
  return {
    customer: x.customer as string | null,
    currency: (x.currency as string).trim().toUpperCase(),
    lines: lines.map((l) => ({ sku: l.sku as string, kg: l.kg as number | null, evidence: l.evidence as string })),
    notInCatalog: x.notInCatalog as string[],
    requestedDiscountPct: x.requestedDiscountPct as number | null,
    questions: x.questions as string[],
    deliveryNote: x.deliveryNote as string | null,
  };
}

function apiKey(): string {
  const key = process.env[API_KEY_VAR];
  if (!key) throw new Error(`${API_KEY_VAR} is not set in .env`);
  return key;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function runAgent(input: RunInput): Promise<Run> {
  const id = newId(), tracer = new Tracer(id, MODEL), started = Date.now();
  const promptVersion = input.promptVersion ?? activePromptVersion();
  const system = readPrompt(promptVersion);
  // Eval runs leave the memory store out, so two batches differ only by their prompt.
  const memories: Memory[] = input.source === "eval" ? [] : memoriesFor(input.customer);
  const ctx = { fxFail: input.fxFail, fxCache: new Map<string, RateResult>() };
  const tools = makeTools(ctx);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content:
    `<customer_memory>${JSON.stringify(memories.map((m) => m.note))}</customer_memory>\n` +
    `<transcript>\n${input.transcript}\n</transcript>` }];
  let extraction: Extraction | null = null, error: string | null = null;
  let step = 1;

  // Fails closed: an API error or a missing key ends the run as needs_info with the error, never a crash.
  try {
    const client = new Anthropic({ apiKey: apiKey() });   // created here, so tests need no API key
    for (; step <= MAX_STEPS; step++) {
      const t0 = Date.now();
      const res = await client.messages.create({ model: MODEL, max_tokens: MAX_TOKENS,
        system, tools: TOOL_SCHEMAS, messages });
      const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
      tracer.llm(step, res.usage, Date.now() - t0, res.stop_reason, text);
      messages.push({ role: "assistant", content: res.content });

      if (res.stop_reason !== "tool_use") {           // the model is done: parse its JSON
        if (res.stop_reason !== "end_turn") error = `model stopped: ${res.stop_reason}`;
        else extraction = parseExtraction(text);
        if (!extraction && !error) error = "final answer was not valid Extraction JSON";
        break;
      }
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const b of res.content) {
        if (b.type !== "tool_use") continue;
        const t1 = Date.now();
        const out = await tools.call(b.name, b.input);
        tracer.tool(step, b.name, b.input, out, Date.now() - t1);
        results.push({ type: "tool_result", tool_use_id: b.id,
          content: JSON.stringify(out), is_error: "error" in out });
      }
      messages.push({ role: "user", content: results });
    }
    if (!extraction && !error) error = `step limit (${MAX_STEPS}) reached`;
  } catch (e) {
    error = errorText(e);
    tracer.error(step, error);
  }

  // Code, not the model, decides the final rate: reuse the cached one, or fetch it now.
  const r = extraction && extraction.currency !== "SEK" ? await getRate(extraction.currency, ctx) : null;
  let fx: Fx | null = null, fxError: string | null = null;
  if (r?.ok === true) {
    const { ok: _ok, ...rate } = r;   // the quote stores the rate, not the lookup flag
    fx = rate;
  }
  if (r?.ok === false) fxError = r.error;
  // The email greets the customer by the name the reviewer entered, like the review panel does.
  // The model's reading stays on the run as it was.
  const named = extraction && input.customer ? { ...extraction, customer: input.customer } : extraction;
  const parts = assemble(named, fx, fxError, error);
  const run: Run = { id, createdAt: new Date().toISOString(), ...input, source: input.source ?? "ui", promptVersion,
    memoryUsed: memories, extraction, ...parts, error, totals: tracer.totals(Date.now() - started) };
  tracer.end(run);
  writeJson(`runs/${id}.json`, run);
  return run;
}
