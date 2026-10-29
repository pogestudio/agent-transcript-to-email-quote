import { buildEmail } from "./email";
import { computeQuote } from "./pricing";
import type { Quote, Review, Run } from "./types";

// What the review panel sends. It comes from the browser, so every field is checked here.
export type ReviewInput = {
  action?: unknown; reason?: unknown; remember?: unknown; customerAnswers?: unknown;
  editedLines?: unknown; discountPct?: unknown;
};
// What a review saves on the run. The agent's own quote and email are never overwritten.
export type Reviewed = { review: Review; editedQuote?: Quote; editedEmail?: string };

const ACTIONS: Review["action"][] = ["approve", "reject", "rerun"];
const MAX_DISCOUNT_PCT = 100;

// Trimmed text, "" when left out, null when it isn't text.
const text = (v: unknown) => (typeof v === "string" ? v.trim() : v === undefined || v === null ? "" : null);
const isLine = (v: unknown) => {
  const l = v as Record<string, unknown>;
  return typeof l === "object" && l !== null && typeof l.sku === "string" && typeof l.kg === "number";
};

// The email a person approves: no open questions. The reviewer's customer name wins, like in the
// agent's draft.
export function approvedEmail(run: Run, quote: Quote | null): string {
  return buildEmail({
    customer: run.customer ?? run.extraction?.customer ?? null, quote, status: run.status, questions: run.questions,
    notInCatalog: run.extraction?.notInCatalog ?? [], deliveryNote: run.extraction?.deliveryNote ?? null,
    approved: true,
  });
}

// A rerun reads the call again with the customer's answers after it.
export const followUpTranscript = (transcript: string, answers?: string) =>
  answers ? `${transcript.trimEnd()}\n\n[Customer follow-up]\n${answers}\n` : transcript;

// The review rules: a reject needs a reason, only a manager sets the discount, and an approval
// with changes is priced by the same code as the agent's draft.
export function applyReview(run: Run, input: ReviewInput, at: string): Reviewed | { error: string } {
  if (run.source === "eval") return { error: "Eval runs are graded by the suite, not reviewed" };
  const action = input.action as Review["action"];
  if (!ACTIONS.includes(action)) return { error: `Unknown action: ${String(input.action)}` };
  const reason = text(input.reason), remember = text(input.remember), answers = text(input.customerAnswers);
  if (reason === null || remember === null || answers === null) {
    return { error: "reason, remember and customerAnswers must be text" };
  }
  if (action === "reject" && !reason) return { error: "Add a reason to reject." };
  if (remember && !run.customer) return { error: "This run has no customer name, so nothing can be remembered." };

  const review: Review = {
    action, reason, at,
    ...(remember ? { remember } : {}),
    ...(action === "rerun" && answers ? { customerAnswers: answers } : {}),
  };
  if (action !== "approve") return { review };

  const discount = input.discountPct ?? null;
  if (discount !== null) {
    if (run.status !== "needs_approval") return { error: "Only a needs_approval run takes a manager discount." };
    if (!Number.isInteger(discount) || (discount as number) < 0 || (discount as number) > MAX_DISCOUNT_PCT) {
      return { error: `Discount must be a whole percent from 0 to ${MAX_DISCOUNT_PCT}.` };
    }
  }
  const edited = input.editedLines;
  if (edited !== undefined && !(Array.isArray(edited) && edited.every(isLine))) {
    return { error: "editedLines must be a list of { sku, kg }" };
  }
  const editedLines = (edited as { sku: string; kg: number }[] | undefined)?.map(({ sku, kg }) => ({ sku, kg }));
  const override = discount as number | null;
  const changed = editedLines !== undefined || override !== null;

  let quote = run.quote;
  if (changed) {
    const lines = editedLines ?? (run.quote?.lines ?? []).map(({ sku, kg }) => ({ sku, kg }));
    try {
      quote = computeQuote(lines, run.quote?.fx ?? null, run.quote?.fxError ?? null, override);
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };   // an unknown SKU or a kg below 1
    }
  }
  if (!quote?.lines.length) return { error: "Add a quantity before approving." };

  return {
    review: {
      ...review,
      ...(run.status === "needs_approval" ? { asManager: true } : {}),
      ...(editedLines ? { editedLines } : {}),
      ...(override !== null ? { discountPct: override } : {}),
    },
    ...(changed ? { editedQuote: quote } : {}),
    // A needs_info draft asks the customer questions, so approving it gives a new email even without changes.
    ...(changed || run.status === "needs_info" ? { editedEmail: approvedEmail(run, quote) } : {}),
  };
}
