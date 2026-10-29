import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readJsonl } from "./store";
import { costUsd, Tracer } from "./trace";
import type { TraceEvent } from "./types";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "kvarn-trace-"));
  vi.stubEnv("KVARN_DATA_DIR", dir);
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("trace", () => {
  it("prices 18,000 input and 1,500 output tokens at 0.051 USD", () => {
    expect(costUsd(18_000, 1_500)).toBe(0.051);
  });

  it("appends one event per call and adds up the totals", () => {
    const tracer = new Tracer("r_1", "claude-sonnet-5-5");
    tracer.llm(1, { input_tokens: 12_000, output_tokens: 500 }, 900, "tool_use", "");
    tracer.tool(1, "price_line", { sku: "KV-KEN-01", kg: 20 }, { error: "Unknown SKU: KV-KEN-01" }, 1);
    tracer.llm(2, { input_tokens: 6_000, output_tokens: 1_000 }, 1200, "end_turn", "{}");

    expect(tracer.totals(2500)).toEqual({ steps: 2, inputTokens: 18_000, outputTokens: 1_500, costUsd: 0.051, ms: 2500 });
    const events = readJsonl<TraceEvent>("traces/r_1.jsonl");
    expect(events.map((e) => e.kind)).toEqual(["llm", "tool", "llm"]);
    expect(events[1]).toMatchObject({ runId: "r_1", step: 1, name: "price_line", isError: true });
    expect(events[2]).toMatchObject({ model: "claude-sonnet-5-5", stopReason: "end_turn", text: "{}" });
  });
});
