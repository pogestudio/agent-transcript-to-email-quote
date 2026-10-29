import { linesText } from "./diff";
import { readJsonl, readRun } from "./store";
import type { Quote, Review } from "./types";

export type Correction = {
  runId: string; at: string; action: Review["action"]; customer: string | null; reason: string;
  draft: string | null; approved: string | null;   // the agent's quote against the approved one; null without edits
};

type Feedback = Review & { runId: string };

const withDiscount = (lines: string, quote: Quote | null) =>
  quote?.discountPct ? `${lines}, ${quote.discountPct}% discount` : lines;

// What reviewers corrected, newest first: every reason, and every approval that changed the agent's
// lines or discount. Reasons are free text and never classified; a person reads them for patterns.
export function loadCorrections(): Correction[] {
  return readJsonl<Feedback>("feedback.jsonl")
    .flatMap((f) => {
      const run = readRun(f.runId), edited = run?.editedQuote ?? null;
      if (!f.reason && !edited) return [];
      return [{
        runId: f.runId, at: f.at, action: f.action, customer: run?.customer ?? null, reason: f.reason,
        draft: run && edited ? withDiscount(linesText(run), run.quote) : null,
        approved: edited ? withDiscount(edited.lines.map((l) => `${l.kg} kg ${l.sku}`).join(", "), edited) : null,
      }];
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}
