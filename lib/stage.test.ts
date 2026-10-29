import { describe, expect, it } from "vitest";
import { STAGE_LABEL, stageOf } from "./stage";
import type { Review, Run, Status } from "./types";

const AT = "2026-10-29T18:00:00.000Z";

const run = (status: Status, fields: Partial<Run> = {}): Run => ({
  id: "r_1", createdAt: AT, source: "ui", transcript: "", customer: "Café Linnea", fxFail: false,
  promptVersion: "v1", memoryUsed: [], extraction: null, blockedSkus: [], quote: null, status,
  reasons: [], questions: [], email: "", error: null,
  totals: { steps: 1, inputTokens: 0, outputTokens: 0, costUsd: 0, ms: 0 }, ...fields,
});
const review = (action: Review["action"]): Review => ({ action, reason: "", at: AT });

describe("stageOf", () => {
  // One row per row of the stage table, in its order.
  it.each([
    ["Sent", run("ready_for_review", { review: review("approve"), sentAt: AT })],
    ["Ready to send", run("needs_approval", { review: review("approve") })],
    ["Rejected", run("ready_for_review", { review: review("reject") })],
    ["Replaced", run("needs_info", { review: review("rerun") })],
    ["Needs manager", run("needs_approval")],
    ["Waiting on customer", run("needs_info")],
    ["To review", run("ready_for_review")],
  ])("%s", (label, r) => {
    expect(STAGE_LABEL[stageOf(r)]).toBe(label);
  });
});
