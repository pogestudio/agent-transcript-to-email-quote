# Possible improvements

## IMPROVEMENTS

You've found a real weak spot. In this design, the AI doesn't need the price at all.

### What the AI actually uses price_line for

Look at the prompt's step 2: "call price_line(sku, kg) to confirm the SKU and the minimum order." The AI needs two answers from it:

1. Does this product code exist?
2. Is the kg at or above the minimum?

The price comes along for the ride. Nothing downstream uses it.

### So why is it there?

Mostly because the brief asks for it. The plan's checklist says the brief requires three tools by name: `search_products`, `price_line` and `convert_currency`. A tool called "price line" that returns no price would look odd. (I can't see the original brief in this repo, so check its exact wording.)

There's one small practical reason too: `convert_currency` takes an SEK amount, and the AI would get that amount from price_line. But code converts the real totals itself afterwards, so even that isn't needed.

### Two ways to defend it to the panel

**A. Keep it, and say the risk is contained.**
"The brief asks for a price_line tool, so the AI has one. It sees the line price, but nothing it returns becomes a number on the quote, and the evals check every price against the catalog."

**B. Hide it.** price_line still computes the price for the trace, but the AI only gets back "product exists, minimum met". This is the security idea of least privilege: never give the AI information it doesn't need.

### My recommendation

Build A, because it matches the brief and the plan, and mention B as a production improvement: "In production I'd strip the price from what the AI sees, because it doesn't need it." That shows the panel you see the gap yourself before they point it out.

## IMPROVEMENTS

So your idea is: people write sloppy notes, so an AI should clean them up, turn each reviewed run or saved memory into an eval case, and keep rerunning until it passes.

I think half of it is very good and half of it would hurt you.

### The good half: AI tidies, a person confirms

* **Memory notes:** the reviewer types "tues pls". The AI suggests "Always wants delivery on Tuesdays". The reviewer clicks OK. The money filter still runs on the final text.
* **Eval cases:** the AI drafts the new case from the reviewed run, and the reviewer confirms the expected answer.
* **Prompt rules:** the AI reads the recurring reasons and drafts the one new rule for v2.

You're right that people are sloppy, and this fixes it. The key is that the AI **suggests** and a person **decides**.

### The bad half: "rerun until it passes"

**1. Rerunning the same prompt proves nothing.** This is the pass^k point from earlier. Results vary from run to run, so if you retry enough times, one run passes by luck. That's pass@k, the measure the plan rejects, because a customer only gets one quote.

**2. If the agent changes the prompt on each loop, it grades its own homework.** It wrote the test and the fix, so it can make the test easy. It will also tune the prompt to that one call, which can break other cases. A sloppy or wrong reviewer reason gets baked in, and nobody checks it.

**3. One eval case per memory doesn't scale.** Every customer habit becomes a test, so the suite and its cost grow forever. The grader also doesn't check the delivery note today. Two general cases cover it better:

* a saved memory gets used
* the call wins when it says something different from the memory

### My recommendation

**For this build:** don't add it. The plan has zero time buffer, and its rule 1 says extras go on the cut list.

**For the panel:** this is a strong answer to "What would you do next?":

> "Reviewer notes are sloppy, so an AI would clean them up and draft eval cases and prompt rules. A person approves each one, and a prompt change still has to pass the gate. I wouldn't let it loop until it passes, because that's retrying until you get lucky."

## IMPROVEMEMNTS

### Not evaling memory right now

Yes, we can check both. "Injected" and "applied" need different kinds of proof.

**1. Injected (code).** Whether a note gets into the prompt is plain code, so a unit test proves it without the model. The extra `agent.test.ts` test I proposed does this: it stores a note, runs the agent against the fake SDK client, and checks that the first message's `<customer_memory>` holds the note and that `run.memoryUsed` lists it. One gap: the trace doesn't record the memory today, only the model's text and the final extraction. I'd add the notes to the trace's end event so you can see them when diagnosing a run.

**2. Applied (model behaviour).** You're right that memory isn't a tool call, so the trace has no "memory used" step. But its effect shows up in the output: the model puts the delivery day in `deliveryNote`, and that goes into the email. So an eval can grade it in code, the same way it grades the lines.

The live memory store still stays out of eval runs, as in decision 1. Instead, an eval case carries its own fixed notes:

| Case | Transcript | Memory | Expected |
| --- | --- | --- | --- |
| TC11 | tc01.txt (it never names a delivery day) | "Always wants delivery on Tuesdays" | Same as TC01, and deliveryNote mentions Tuesday |
| TC12 | New: like TC01, but the customer says "this time on Thursday" | Same note | deliveryNote says Thursday, not Tuesday (the prompt's "transcript wins" rule) |

TC11 uses the same transcript as TC01. "Tuesday" can only come from the memory, so a pass proves the model read it. TC12 tests the conflict rule. If a future prompt breaks memory, the Phase 8 gate catches it.

What changes:

* `EvalCase` gains `memory?: string[]` and `expected.deliveryNote?: string`. That is a word that must appear, ignoring case; for TC12 the case also fails if "Tuesday" appears.
* `grade` gets a delivery check, which is skipped when not expected, like total for TC05.
* `runSuite` passes the case's notes to `runAgent`, and they show under "Memory used" on the run page.
* New `evals.test.ts` cases for the delivery check.

What it costs:

* A batch at k = 3 grows from 30 to 36 runs, about $0.09 more.
* The committed v1 baseline has no TC11 or TC12, so Phase 8's gate would have nothing to compare them against. I'd rerun the v1 baseline at k = 3 once (about $0.55, under a minute) and make that the baseline. The old one stays on disk.
* This goes beyond Phase 7's list, so I'd note it as an addition in progress.md.

Should I add TC11, TC12, the delivery check and the trace field to the plan, and rerun the baseline at the end?
