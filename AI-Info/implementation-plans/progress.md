# Progress

Oct 29, 2026 · Sessions 1 to 4

## Summary

Phases 1 to 3 are done. The UI runs end to end on a fake agent: the Run button posts to `POST /api/run`, which saves a real run and trace in `data/`. Since Phase 2, every number, the status and the email come from `assemble()`, and all money and status rules are proven by unit tests. The review flow (manager discount, stages, Mark as sent) still works in the browser only and saves nothing. Since Phase 3, the three tools and the live FX lookup exist as tested library code, but nothing calls them until the real agent arrives in Phase 4.

## What was built

### Phase 1 UI on fake data

- `/` Review: new run form (transcript dropdown, `.txt` upload, textarea, customer name, "Simulate FX failure", Run) and the inbox with stage badges, totals and the filters All, To do, Ready to send, Sent, Rejected.
- `/runs/[id]`: header with the stage, an "Agent's assessment" card (status, reasons, questions), the quote, the email with Copy, the review panel and the trace (totals row, one expandable row per event with input and output, raw JSONL).
- `/evals`: placeholder. Header nav links Review and Evals.
- The Run button posts to `POST /api/run` and opens the new run (Session 2). In Session 1 it opened a saved fake run.
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
- Their unit tests were written in Session 3 (see below). Before that, a quick script checked the numbers: 15% on 120 kg House Espresso gives 4,320 off and 24,480 SEK; the standard 10% gives 25,920 SEK; TC05 with 20 kg gives 6,450 SEK.

### Review flow (browser only)

- `lib/stage.ts`: `stageOf(run)` works out the stage from the review and `sentAt`.
- Review panel: a kg field per line, a discount field on needs\_approval runs, one Reason box ("Enter reason for approval, edit or reject"), and a live preview of the quote and the email.
- Buttons: Approve (Manager approve on needs\_approval, "with changes" when edited), Reject, Rerun (disabled until the real agent exists) and, after approval, Mark as sent.
- A refresh resets the page. Saving arrives with the review route in Phase 7.

### Session 2: the rest of Phase 1

- Setup: `@anthropic-ai/sdk`, `vitest` and `vite-tsconfig-paths` installed, `vitest.config.mts` added, and `npm test` runs `vitest run`.
- `lib/store.ts`: reads `KVARN_DATA_DIR` on every call, so tests can point it at a temp folder. New: `newId()`, `writeJson`, `appendJsonl`, `listRuns(source?)` (newest first) and `readTranscript(name)` (only plain `.txt` names, so no path tricks).
- `lib/agent.ts`: a fake `runAgent({ transcript, customer, fxFail, parentId? })`. Every transcript gets the TC01 answer (20 kg House Espresso, 5,050 SEK, ready\_for\_review), built with the real `computeQuote` and `buildEmail`, plus a 3 event trace (llm, tool `price_line`, end). The FX checkbox is saved on the run but has no effect yet.
- Routes: `GET /api/transcripts`, `GET /api/transcripts/[name]`, `POST /api/run` (400 on an empty transcript), `GET /api/runs?source=` (400 on an unknown source) and `GET /api/runs/[id]` (`{run, trace, children}`, 404 when missing).
- `NewRunForm` posts to `/api/run`, opens the new run, and shows the error under the form when it fails. `app/page.tsx` uses `listRuns("ui")`.
- `lib/store.test.ts`: writes and reads a run, round trips `appendJsonl` and `readJsonl`, sorts runs newest first, and checks the id format.
- `TIMELOG.md` started, drafted from file and commit times.

### Session 3: Phase 2

- `lib/status.ts`: `decideStatus(extraction, quote, fxError)` checks the rules in the order of the status table and adds every reason that fires. The status is the highest one: needs\_info, then needs\_approval, then ready\_for\_review.
- `lib/assemble.ts`: `assemble(extraction, fx, fxError, agentError)` moves unknown SKUs to `blockedSkus` and into `notInCatalog` as "{sku} (unknown code)", leaves `kg: null` lines out of the quote, then calls `computeQuote`, `decideStatus` and `buildEmail`. The model's extraction saved on the run is never changed.
- `lib/agent.ts`: the fake agent passes its TC01 extraction through `assemble()` instead of calling `computeQuote` and `buildEmail` itself.
- Tests: `pricing.test.ts`, `status.test.ts`, `email.test.ts` and `assemble.test.ts`, 50 new tests. All 9 Phase 5 totals are in a table test; TC05 has no total and is covered in `assemble.test.ts`.
- One email test was added beyond the plan's list: the standard tier is labelled "Volume discount" and a manager override "Discount".
- The untracked test run `r_20261029_154130_5hr8` was deleted.

### Session 4: Phase 3

- `lib/fx.ts`: `getRate(currency, ctx)` calls Frankfurter with a 5 second timeout and returns `{ ok: true, currency, rate, rateDate, fetchedAt, source }` or `{ ok: false, error }`. It uppercases the code and only accepts 3 letters before building the URL. `fxFail` fails on purpose without a fetch. The result is cached per currency in `ctx.fxCache`, failures included.
- `lib/tools.ts`: `TOOL_SCHEMAS` as in Contracts, `searchProducts(query)` and `makeTools(ctx)` → `{ call(name, input) }`. `call` checks the input types, returns `{ error }` for an unknown tool or bad input, and wraps everything in `try/catch`, so it never throws.
- `search_products` matches whole words of the query against the product name and keywords, ignoring case and punctuation, and returns `{ sku, name, minKg }[]` in catalog order.
- `convert_currency` returns `{ ok: true, currency: "SEK", amount, rate: 1 }` for SEK without a lookup. For other codes it returns the plan's shape plus `currency`, with the amount rounded to 2 decimals like the quote.
- `lib/tools.test.ts`: the 12 tests the plan lists, plus 3 extras the user picked: a valid `price_line`, an unknown tool name and a missing `query`. A fourth extra (an invalid code like "EURO" never reaches `fetch`) was dropped; the check is in the code and was verified live instead.

## Decisions

1. **Status and stage are separate.** Status is the agent's verdict and the only thing the evals grade. The stage (To review, Needs manager, Waiting on customer, Ready to send, Sent, Rejected, Replaced) is where the run is in its life and is never graded.
2. **Sent is manual.** The app sends nothing. The person copies the email, sends it from their own mail and clicks Mark as sent.
3. **A manager can grant a higher discount.** On needs\_approval runs the manager can set any whole discount from 0 to 100%. No reason is required. Code recalculates the quote and email with the same pricing function. The override is stored on the review, never as a memory, and the agent can never set it.
4. **Approve approves what is in the panel.** There is no separate edit step and no second approval after an edit.
5. **One reason, never classified.** A single free text Reason box: required to reject, optional to approve. No categories.
6. **The agent's draft is never overwritten.** The original quote, email and status stay as the agent produced them; a reviewer's result goes to `editedQuote` and `editedEmail`.
7. **The Remember checkbox waits** until memory is built in Phase 7.
8. **"No product identified"** fires only when the extraction has no lines, no items we don't sell and no model questions, so it never repeats what another reason already says.
9. **"All pricing rules met"** only appears when nothing at all fired. An FX failure alone shows just its own reason.
10. **Money in reasons** uses `formatSek`, for example "50 220 SEK after discount is above the 50 000 SEK limit".
11. **No priced lines** (TC05) gives a quote with zero lines, not `null`, and the inbox shows "Not priced".
12. **Agent error** (no extraction): the quote is `null` and the email is empty, because there is nothing to send the customer.
13. **A failed rate lookup is cached for the run.** Each run does at most one lookup per currency, so the quote always uses the same result the model saw. A new run tries again.
14. **The currency code is checked before it goes into the URL.** It comes from the model, so only 3 letters ever reach Frankfurter.
15. **Search uses whole words.** "Kenya AA" finds nothing instead of matching on "aa". "morning filter" returns both filters, and the model picks by name.

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

- Session 1, new: `lib/types.ts`, `lib/store.ts`, `lib/format.ts`, `lib/catalog.ts`, `lib/pricing.ts`, `lib/email.ts`, `lib/stage.ts`, `components/` (NavLink, StatusBadge, StageBadge, Inbox, NewRunForm, QuoteView, RunDetail, ReviewPanel, CopyButton, TraceView), `app/globals.css`, `app/runs/[id]/page.tsx`, `app/evals/page.tsx`, `data/`.
- Session 1, changed: `app/layout.tsx`, `app/page.tsx`, `AI-Info/implementation-plans/build-plan.md`.
- Session 2, new: `lib/agent.ts`, `lib/store.test.ts`, `app/api/` (five route files), `vitest.config.mts`, `TIMELOG.md`.
- Session 2, changed: `lib/store.ts`, `components/NewRunForm.tsx`, `app/page.tsx`, `package.json`, `package-lock.json`.
- Session 3, new: `lib/status.ts`, `lib/assemble.ts`, `lib/pricing.test.ts`, `lib/status.test.ts`, `lib/email.test.ts`, `lib/assemble.test.ts`.
- Session 3, changed: `lib/agent.ts`, `TIMELOG.md`.
- Session 4, new: `lib/fx.ts`, `lib/tools.ts`, `lib/tools.test.ts`.
- Session 4, changed: `TIMELOG.md`, `AI-Info/implementation-plans/progress.md`.

## Checks

- Session 1: `tsc --noEmit` passes. Every page returns 200 on the dev server, and an unknown run id returns 404. The review panel buttons were not clicked through by Claude (no browser available) and still need a manual check.
- Session 2: `npm test` passes (5 tests) and `tsc --noEmit` passes. Claude checked every route with curl, including the 400 and 404 cases and a `../../package.json` transcript name. The user clicked through the new run flow in the browser and confirmed it works.
- Session 3: `npm test` passes (55 tests) and `tsc --noEmit` passes. Claude posted a TC01 run to the dev server with curl: 5,050 SEK, ready\_for\_review, the full email and a 3 event trace, and the run page returned 200. That run was deleted afterwards. The run page in the browser still needs a manual check.
- Session 4: `npm test` passes (70 tests) and `tsc --noEmit` passes. Claude ran a live check against the real Frankfurter API from a scratch script outside the repo:
  - TC07's 13,870 SEK became 1,260.96 EUR at 0.090913 (rate date 2026-10-29), and NOK worked too.
  - A second EUR call in the same run made no fetch.
  - "XYZ" got HTTP 404 and failed closed, and the cached failure made no second fetch.
  - "EURO" and "EUR&base=USD" were refused without a fetch, and `fxFail` failed without one.
  - Ten realistic search phrases returned the expected SKUs.
  
  Nothing is visible in the UI yet.

## Notes

- Next allows one `next dev` per project folder. A second one exits with "Another next dev server is already running".
- After an `npm install` or big edits, the browser can keep running old client code. We saw "Cannot read properties of undefined (reading 'find')" from the removed `fakeRuns` code; restarting the dev server fixed it.
- Vitest prints that `vite-tsconfig-paths` is no longer needed. The project has no path aliases, so it could be dropped for `resolve.tsconfigPaths: true`. Kept because the plan lists it.
- `.env` defines `ANTHROPIC_AGENT_API_KEY`, but `new Anthropic()` reads `ANTHROPIC_API_KEY`. Fix before Phase 4.
- Frankfurter answers a known code in about 0.15 s, but its 404 for an unknown code takes 0.3 to 2.3 s on its side. In the first live run every call hit the 5 second timeout and failed closed as designed. It did not happen again in four more runs. The demo runs are generated beforehand anyway (Phase 9).
- A successful `getRate` result includes `ok: true`. Passed straight to `computeQuote` as `Fx`, it would end up stored in `quote.fx`.

## Next

- Phase 4: `prompts/`, `lib/trace.ts`, `parseExtraction` and the real `runAgent`, with `agent.test.ts` and `trace.test.ts`.
- Phase 4: remove `ok` from the `getRate` result before it goes into `assemble()`.
- Phase 4: `parseExtraction` must reject kg below 1, not only fractions. Otherwise `kg: 0` from the model makes `priceLine` throw inside `assemble()`.
- Correct the times in `TIMELOG.md`.
