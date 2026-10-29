# Progress

Oct 29, 2026 · Session 1

## Summary

The Phase 1 UI runs on fake JSON data. The review flow (manager discount, stages, Mark as sent) works in the browser only and saves nothing. Some Phase 2 code was pulled forward because the live preview needs it. Nothing is committed yet.

## What was built

### Phase 1 UI on fake data

- `/` Review: new run form (transcript dropdown, `.txt` upload, textarea, customer name, "Simulate FX failure", Run) and the inbox with stage badges, totals and the filters All, To do, Ready to send, Sent, Rejected.
- `/runs/[id]`: header with the stage, an "Agent's assessment" card (status, reasons, questions), the quote, the email with Copy, the review panel and the trace (totals row, one expandable row per event with input and output, raw JSONL).
- `/evals`: placeholder. Header nav links Review and Evals.
- The Run button is fake: it opens the saved run for the picked transcript, or the newest run, until `POST /api/run` exists.
- Styling is plain CSS in `app/globals.css` with colour variables at the top. Tailwind is not installed.

### Fake data (to be replaced by real runs)

Five transcripts in `data/transcripts/`, five runs in `data/runs/` and five traces in `data/traces/`. They were made by a single use generator script kept outside the repo. Every total matches the plan's Phase 5 table.

| Case | Customer | Agent status | Stage | Total excl. VAT |
| --- | --- | --- | --- | --- |
| TC01 | Café Linnea | ready\_for\_review | To review | 5,050 SEK |
| TC04 | Hotell Fjällgatan | needs\_approval (asked 15%) | Needs manager | 25,920 SEK |
| TC05 | Bageri Kanel | needs\_info (vague quantity) | Waiting on customer | not priced |
| TC07 | Pohjola Studio | ready\_for\_review (EUR) | Sent | 13,870 SEK, 1 208,08 EUR |
| TC08 | Kaffeehaus Mitte | ready\_for\_review (FX failed) | Ready to send | 6,900 SEK |

### Pulled forward from Phase 2

- `lib/catalog.ts` and `lib/pricing.ts` as in the Contracts section, plus the manager discount override in `computeQuote`.
- `lib/email.ts`: `buildEmail` with an `approved` flag.
- Their unit tests are not written yet and stay in Phase 2. A quick script checked the numbers: 15% on 120 kg House Espresso gives 4,320 off and 24,480 SEK; the standard 10% gives 25,920 SEK; TC05 with 20 kg gives 6,450 SEK.

### Review flow (browser only)

- `lib/stage.ts`: `stageOf(run)` works out the stage from the review and `sentAt`.
- Review panel: a kg field per line, a discount field on needs\_approval runs, one Reason box ("Enter reason for approval, edit or reject"), and a live preview of the quote and the email.
- Buttons: Approve (Manager approve on needs\_approval, "with changes" when edited), Reject, Rerun (disabled until the real agent exists) and, after approval, Mark as sent.
- A refresh resets the page. Saving arrives with the review route in Phase 7.

## Decisions

1. **Status and stage are separate.** Status is the agent's verdict and the only thing the evals grade. The stage (To review, Needs manager, Waiting on customer, Ready to send, Sent, Rejected, Replaced) is where the run is in its life and is never graded.
2. **Sent is manual.** The app sends nothing. The person copies the email, sends it from their own mail and clicks Mark as sent.
3. **A manager can grant a higher discount.** On needs\_approval runs the manager can set any whole discount from 0 to 100%. No reason is required. Code recalculates the quote and email with the same pricing function. The override is stored on the review, never as a memory, and the agent can never set it.
4. **Approve approves what is in the panel.** There is no separate edit step and no second approval after an edit.
5. **One reason, never classified.** A single free text Reason box: required to reject, optional to approve. No categories.
6. **The agent's draft is never overwritten.** The original quote, email and status stay as the agent produced them; a reviewer's result goes to `editedQuote` and `editedEmail`.
7. **The Remember checkbox waits** until memory is built in Phase 7.

## Where a decision will be saved (Phase 7)

- `data/runs/<id>.json`: `review`, `editedQuote`, `editedEmail` and later `sentAt`.
- `data/feedback.jsonl`: one line per decision; the Evals page reads it to find corrections that keep coming back.
- Never `data/memory.json`: memories are lasting customer preferences, and notes about prices or discounts are refused.

## Contract changes

- `Quote.discountPct` is any whole percent, not only 0, 5 or 10.
- `Review`: the `edit` action and `category` are removed; `reason` is required to reject and optional to approve; `discountPct` holds a manager override.
- `Run` gains `editedEmail` and `sentAt`.
- `computeQuote` takes an optional `discountOverridePct`.

## Plan updates in `build-plan.md`

- Contracts: the new types, the pricing override and a new Stage section.
- Pages, layout and route table: stage instead of status in the inbox, new components, and `POST /api/runs/[id]/sent`.
- Phase 1: the inbox, run page and badge descriptions, and the fake JSON data.
- Phase 2: email wording for manager discounts and the `approved` flag; new pricing and email test cases.
- Phase 7: review rules (reject needs a reason, approve takes an optional one, no categories), the review panel, `stage.test.ts`, and a TC04 manager approval in the deliverable.
- Phase 8: the corrections panel is a plain list of reasons and approved edits instead of counts by category.
- Production notes, one panel answer, Assumptions 7 and 15, a new Assumption 17, and the cut list.

## Files

- New: `lib/types.ts`, `lib/store.ts`, `lib/format.ts`, `lib/catalog.ts`, `lib/pricing.ts`, `lib/email.ts`, `lib/stage.ts`, `components/` (NavLink, StatusBadge, StageBadge, Inbox, NewRunForm, QuoteView, RunDetail, ReviewPanel, CopyButton, TraceView), `app/globals.css`, `app/runs/[id]/page.tsx`, `app/evals/page.tsx`, `data/`.
- Changed: `app/layout.tsx`, `app/page.tsx`, `AI-Info/implementation-plans/build-plan.md`.

## Checks

- `tsc --noEmit` passes. Every page returns 200 on the dev server, and an unknown run id returns 404.
- The buttons were not clicked through by Claude (no browser available); they need a manual check.

## Next

- The rest of Phase 1: the API routes (`/api/transcripts`, `/api/run`, `/api/runs`), the fake `runAgent`, Vitest setup with `store.test.ts`, and the Run button posting to `/api/run`.
- Phase 2: `status.ts`, `assemble.ts` and the unit tests for pricing, status, email and assemble.
- `TIMELOG.md` (plan rule 5) is not started.
- Commit when you are happy with the UI.
