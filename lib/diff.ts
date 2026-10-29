import { formatSek } from "./format";
import type { Run } from "./types";

export type Change = { field: string; before: string; after: string };

const NONE = "none";

// The lines the quote was built from, an unclear quantity as "? kg".
export const linesText = (run: Run) => {
  const lines = (run.extraction?.lines ?? []).filter((l) => !run.blockedSkus.includes(l.sku));
  return lines.length ? lines.map((l) => `${l.kg ?? "?"} kg ${l.sku}`).join(", ") : NONE;
};
const totalText = (run: Run) => (run.quote?.lines.length ? formatSek(run.quote.totalExclVatSek) : "Not priced");
const currencyText = (run: Run) => (run.quote ? (run.quote.fx?.currency ?? "SEK") : NONE);
const memoryText = (run: Run) => (run.memoryUsed.length ? run.memoryUsed.map((m) => m.note).join("; ") : NONE);

const FIELDS: [string, (run: Run) => string][] = [
  ["Status", (r) => r.status],
  ["Reasons", (r) => r.reasons.join("; ")],
  ["Lines", linesText],
  ["Total excl. VAT", totalText],
  ["Currency", currencyText],
  ["Memory used", memoryText],
  ["Prompt version", (r) => r.promptVersion],
];

const emailLines = (email: string) => email.split("\n").filter((line) => line.trim());

// What changed in the agent's draft from a run to its rerun. The email is compared line by line:
// before holds the lines only the parent has, after the lines only the rerun has.
export function diffRuns(parent: Run, child: Run): Change[] {
  const changes = FIELDS.flatMap(([field, text]) => {
    const before = text(parent), after = text(child);
    return before === after ? [] : [{ field, before, after }];
  });
  const was = emailLines(parent.email), now = emailLines(child.email);
  const removed = was.filter((line) => !now.includes(line)), added = now.filter((line) => !was.includes(line));
  if (removed.length || added.length) {
    changes.push({ field: "Email", before: removed.join("\n") || NONE, after: added.join("\n") || NONE });
  }
  return changes;
}
