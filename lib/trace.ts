import type Anthropic from "@anthropic-ai/sdk";
import { appendJsonl } from "./store";
import type { Run, TraceEvent } from "./types";

// USD per million tokens for claude-sonnet-5-5, checked on the pricing page on Oct 29, 2026.
export const PRICE_PER_MTOK = { input: 2, output: 10 };

export const costUsd = (inputTokens: number, outputTokens: number) =>
  (inputTokens * PRICE_PER_MTOK.input + outputTokens * PRICE_PER_MTOK.output) / 1_000_000;

type Usage = Pick<Anthropic.Usage, "input_tokens" | "output_tokens">;

// Appends one TraceEvent per step to data/traces/<runId>.jsonl and keeps the running totals.
export class Tracer {
  private steps = 0;
  private inputTokens = 0;
  private outputTokens = 0;

  constructor(private readonly runId: string, private readonly model: string) {}

  private write(step: number, kind: TraceEvent["kind"], fields: Record<string, unknown>) {
    const event: TraceEvent = { runId: this.runId, ts: new Date().toISOString(), step, kind, ...fields };
    appendJsonl(`traces/${this.runId}.jsonl`, event);
  }

  llm(step: number, usage: Usage, ms: number, stopReason: string | null, text: string) {
    this.steps = step;
    this.inputTokens += usage.input_tokens;
    this.outputTokens += usage.output_tokens;
    this.write(step, "llm", {
      model: this.model, usage: { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens },
      ms, stopReason, ...(text ? { text } : {}),
    });
  }

  tool(step: number, name: string, input: unknown, output: object, ms: number) {
    this.write(step, "tool", { name, input, output, ms, isError: "error" in output });
  }

  error(step: number, error: string) {
    this.write(step, "error", { error });
  }

  end(run: Run) {
    this.write(run.totals.steps, "end", {
      status: run.status, reasons: run.reasons, error: run.error, extraction: run.extraction, totals: run.totals,
    });
  }

  totals(ms: number): Run["totals"] {
    return {
      steps: this.steps, inputTokens: this.inputTokens, outputTokens: this.outputTokens,
      costUsd: costUsd(this.inputTokens, this.outputTokens), ms,
    };
  }
}
