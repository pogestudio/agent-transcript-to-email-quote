import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_KEY_VAR, MAX_STEPS, parseExtraction, runAgent } from "./agent";
import { addMemory } from "./memory";
import { readJson, readJsonl } from "./store";
import type { Run, TraceEvent } from "./types";

// A scripted stand-in for the SDK client: each test queues the model's responses.
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create }; } }));

const EXTRACTION = {
  customer: "Café Linnea", currency: "SEK",
  lines: [{ sku: "KV-ESP-01", kg: 20, evidence: "Twenty kilo. Tjugo." }],
  notInCatalog: [], requestedDiscountPct: null, questions: [], deliveryNote: null,
};
const JSON_TEXT = JSON.stringify(EXTRACTION);
const withKg = (kg: unknown) => JSON.stringify({ ...EXTRACTION, lines: [{ ...EXTRACTION.lines[0], kg }] });

describe("parseExtraction", () => {
  it.each([
    ["plain JSON", JSON_TEXT],
    ["JSON inside prose", `Here is the extraction:\n${JSON_TEXT}\nLet me know if anything is missing.`],
    ["a fenced block", "```json\n" + JSON_TEXT + "\n```"],
  ])("accepts %s", (_, text) => {
    expect(parseExtraction(text)).toEqual(EXTRACTION);
  });

  it("accepts kg null for an unclear quantity", () => {
    expect(parseExtraction(withKg(null))?.lines[0].kg).toBeNull();
  });

  it("rejects a missing array", () => {
    const { questions: _questions, ...rest } = EXTRACTION;
    expect(parseExtraction(JSON.stringify(rest))).toBeNull();
  });

  it.each([2.5, 0, -5, "20"])("rejects kg %j", (kg) => {
    expect(parseExtraction(withKg(kg))).toBeNull();
  });

  it("rejects text without JSON", () => {
    expect(parseExtraction("I could not find an order in this call.")).toBeNull();
  });

  it("keeps only the contract's fields, so a price never gets through", () => {
    const parsed = parseExtraction(JSON.stringify({ ...EXTRACTION, totalSek: 4800 }));
    expect(parsed).toEqual(EXTRACTION);
  });

  it("uppercases the currency code", () => {
    expect(parseExtraction(JSON.stringify({ ...EXTRACTION, currency: "eur" }))?.currency).toBe("EUR");
  });
});

// Model responses in the shape the SDK returns.
const usage = { input_tokens: 1000, output_tokens: 100 };
const toolUse = (id: string, name: string, input: object) =>
  ({ content: [{ type: "tool_use", id, name, input }], stop_reason: "tool_use", usage });
const answer = (text: string, stop_reason = "end_turn") =>
  ({ content: [{ type: "text", text }], stop_reason, usage });

describe("runAgent", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "kvarn-agent-"));
    vi.stubEnv("KVARN_DATA_DIR", dir);
    vi.stubEnv(API_KEY_VAR, "test-key");
    create.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const input = { transcript: "C: Twenty kilo of the House Espresso.", customer: "Café Linnea", fxFail: false };
  const traceOf = (run: Run) => readJsonl<TraceEvent>(`traces/${run.id}.jsonl`);

  it("runs the tool loop, then code prices the extraction", async () => {
    create
      .mockResolvedValueOnce(toolUse("tu_1", "search_products", { query: "house espresso" }))
      .mockResolvedValueOnce(toolUse("tu_2", "price_line", { sku: "KV-ESP-01", kg: 20 }))
      .mockResolvedValueOnce(answer(JSON_TEXT));
    const run = await runAgent(input);

    expect(run).toMatchObject({ status: "ready_for_review", error: null, promptVersion: "v1", source: "ui" });
    expect(run.quote?.totalExclVatSek).toBe(5050);
    expect(run.totals).toMatchObject({ steps: 3, inputTokens: 3000, outputTokens: 300, costUsd: 0.009 });
    expect(readJson<Run>(`runs/${run.id}.json`)).toEqual(run);

    // The tool result goes back to the model under the id of its call.
    expect(create.mock.calls[1][0].messages[2]).toEqual({ role: "user", content: [
      { type: "tool_result", tool_use_id: "tu_1", content: expect.stringContaining("KV-ESP-01"), is_error: false },
    ] });
    expect(traceOf(run).map((e) => `${e.step}:${e.kind}`))
      .toEqual(["1:llm", "1:tool", "2:llm", "2:tool", "3:llm", "3:end"]);
  });

  it("greets the customer by the name the reviewer entered", async () => {
    const extraction = { ...EXTRACTION, customer: "Linnea, Café Linnea (Södermalm)" };
    create.mockResolvedValueOnce(answer(JSON.stringify(extraction)));
    const run = await runAgent(input);
    expect(run.email.split("\n")[0]).toBe("Hi Café Linnea,");
    expect(run.extraction?.customer).toBe("Linnea, Café Linnea (Södermalm)");
  });

  it("sends the customer's memories to the model and saves them on the run", async () => {
    const memory = addMemory("Café Linnea", "Always wants delivery on Tuesdays", "r_parent");
    create.mockResolvedValueOnce(answer(JSON_TEXT));
    const run = await runAgent(input);
    expect(create.mock.calls[0][0].messages[0].content)
      .toContain(`<customer_memory>${JSON.stringify([memory.note])}</customer_memory>`);
    expect(run.memoryUsed).toEqual([memory]);
  });

  it("leaves the memory store out of eval runs", async () => {
    addMemory("Café Linnea", "Always wants delivery on Tuesdays", "r_parent");
    create.mockResolvedValueOnce(answer(JSON_TEXT));
    const run = await runAgent({ ...input, source: "eval" });
    expect(create.mock.calls[0][0].messages[0].content).toContain("<customer_memory>[]</customer_memory>");
    expect(run.memoryUsed).toEqual([]);
  });

  it("sends a tool error back to the model with is_error", async () => {
    create
      .mockResolvedValueOnce(toolUse("tu_1", "price_line", { sku: "KV-KEN-01", kg: 20 }))
      .mockResolvedValueOnce(answer(JSON_TEXT));
    await runAgent(input);
    expect(create.mock.calls[1][0].messages[2].content[0])
      .toMatchObject({ tool_use_id: "tu_1", is_error: true });
  });

  it("gives needs_info on JSON that doesn't fit the contract", async () => {
    create.mockResolvedValueOnce(answer(withKg(2.5)));
    const run = await runAgent(input);
    expect(run).toMatchObject({ status: "needs_info", quote: null, error: "final answer was not valid Extraction JSON" });
  });

  it("names the stop reason when the model stops early", async () => {
    create.mockResolvedValueOnce(answer('{"customer": "Café', "max_tokens"));
    const run = await runAgent(input);
    expect(run).toMatchObject({ status: "needs_info", error: "model stopped: max_tokens" });
  });

  it("stops at the step limit", async () => {
    create.mockResolvedValue(toolUse("tu_n", "search_products", { query: "espresso" }));
    const run = await runAgent(input);
    expect(create).toHaveBeenCalledTimes(MAX_STEPS);
    expect(run).toMatchObject({ status: "needs_info", error: `step limit (${MAX_STEPS}) reached` });
  });

  it("saves a needs_info run when the API call fails", async () => {
    create
      .mockResolvedValueOnce(toolUse("tu_1", "search_products", { query: "espresso" }))
      .mockRejectedValueOnce(new Error("529 Overloaded"));
    const run = await runAgent(input);
    expect(run).toMatchObject({ status: "needs_info", error: "529 Overloaded", quote: null });
    expect(run.reasons).toEqual(["Agent could not finish: 529 Overloaded. See the trace"]);
    expect(traceOf(run).at(-2)).toMatchObject({ step: 2, kind: "error", error: "529 Overloaded" });
    expect(readJson<Run>(`runs/${run.id}.json`)?.status).toBe("needs_info");
  });

  it("fails closed without calling the model when the key is missing", async () => {
    vi.stubEnv(API_KEY_VAR, "");
    const run = await runAgent(input);
    expect(create).not.toHaveBeenCalled();
    expect(run).toMatchObject({ status: "needs_info", error: `${API_KEY_VAR} is not set in .env` });
  });
});
