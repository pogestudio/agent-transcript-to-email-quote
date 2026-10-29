"use client";

import Link from "next/link";
import { useState } from "react";
import CopyButton from "./CopyButton";
import QuoteView from "./QuoteView";
import ReviewPanel, { type Decision, type DraftLine } from "./ReviewPanel";
import StageBadge from "./StageBadge";
import StatusBadge from "./StatusBadge";
import { findProduct } from "../lib/catalog";
import { buildEmail } from "../lib/email";
import { formatDateTime, formatSek } from "../lib/format";
import { computeQuote, discountPct as volumeDiscountPct } from "../lib/pricing";
import { stageOf } from "../lib/stage";
import type { Quote, Run } from "../lib/types";

const WHOLE_NUMBER = /^\d+$/;

const kgText = (kg: number | null) => (kg === null ? "" : String(kg));
const validKg = (text: string) => WHOLE_NUMBER.test(text) && Number(text) >= 1;

// The lines a reviewer can edit: the agent's catalog lines, unclear quantities included.
function draftLinesOf(run: Run): DraftLine[] {
  const source = run.extraction?.lines ?? run.quote?.lines ?? [];
  return source.flatMap((line) => {
    const product = findProduct(line.sku);
    return product ? [{ sku: line.sku, name: product.name, minKg: product.minKg, kg: line.kg }] : [];
  });
}

// Browser only for now: decisions live in component state until the review route exists.
export default function RunDetail({ run: savedRun }: { run: Run }) {
  const [run, setRun] = useState(savedRun);
  const draftLines = draftLinesOf(savedRun);
  const [kg, setKg] = useState<Record<string, string>>(() =>
    Object.fromEntries(draftLines.map((line) => [line.sku, kgText(line.kg)])),
  );
  const [discount, setDiscount] = useState("");

  const lines = draftLines.flatMap((line) => (validKg(kg[line.sku]) ? [{ sku: line.sku, kg: Number(kg[line.sku]) }] : []));
  const kgOk = draftLines.every((line) => kg[line.sku] === "" || validKg(kg[line.sku]));
  const discountOk = discount === "" || (WHOLE_NUMBER.test(discount) && Number(discount) <= 100);
  const override = discount !== "" && discountOk ? Number(discount) : null;
  const linesChanged = draftLines.some((line) => kg[line.sku] !== kgText(line.kg));
  const changed = linesChanged || override !== null;

  const preview = computeQuote(lines, run.quote?.fx ?? null, run.quote?.fxError ?? null, override);
  const finalQuote = changed ? preview : run.quote;
  const blocker = !kgOk
    ? "Kg must be whole numbers."
    : !discountOk
      ? "Discount must be a whole percent from 0 to 100."
      : !finalQuote?.lines.length
        ? "Add a quantity before approving."
        : null;

  const emailFor = (quote: Quote | null) =>
    buildEmail({
      customer: run.customer,
      quote,
      status: run.status,
      questions: run.questions,
      notInCatalog: run.extraction?.notInCatalog ?? [],
      deliveryNote: run.extraction?.deliveryNote ?? null,
      approved: true,
    });

  const approved = run.review?.action === "approve";
  const previewing = !run.review && changed;
  const shownQuote = approved ? (run.editedQuote ?? run.quote) : previewing ? preview : run.quote;
  const shownEmail = approved ? (run.editedEmail ?? run.email) : previewing ? emailFor(preview) : run.email;
  const differsFromAgent = shownQuote !== run.quote;

  function decide({ action, reason }: Decision) {
    const at = new Date().toISOString();
    if (action === "reject") {
      setRun({ ...run, review: { action, reason, at } });
      return;
    }
    setRun({
      ...run,
      review: {
        action, reason, at,
        asManager: run.status === "needs_approval" || undefined,
        discountPct: override ?? undefined,
        editedLines: linesChanged ? lines : undefined,
      },
      editedQuote: changed ? preview : undefined,
      editedEmail: changed || run.status !== "ready_for_review" ? emailFor(finalQuote) : undefined,
    });
  }

  return (
    <>
      <div className="run-head">
        <Link href="/" className="back">
          ← Inbox
        </Link>
        <div className="run-title">
          <h1>{run.customer ?? "Unknown customer"}</h1>
          <StageBadge stage={stageOf(run)} large />
        </div>
        <div className="meta">
          <span>{formatDateTime(run.createdAt)}</span>
          <span>Prompt {run.promptVersion}</span>
          {run.fxFail && <span>FX failure simulated</span>}
          <code>{run.id}</code>
        </div>
      </div>

      <section className={`card status-card status-${run.status}`}>
        <div className="card-head">
          <h2>Agent&apos;s assessment</h2>
          <StatusBadge status={run.status} />
        </div>
        <div className="status-grid">
          <div>
            <span className="label">Why</span>
            <ul className="list">
              {run.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
          {run.questions.length > 0 && (
            <div>
              <span className="label">Questions for the customer</span>
              <ol className="list">
                {run.questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </section>

      <details className="card transcript">
        <summary>
          <div className="transcript-head">
            <span className="chevron" aria-hidden="true">
              ▸
            </span>
            <h2>Transcript</h2>
            <span className="hint">{run.transcript.trim().split("\n").length} lines</span>
          </div>
        </summary>
        <pre className="email transcript-text">{run.transcript.trim()}</pre>
      </details>

      <div className="two-col">
        <section className="card">
          <div className="card-head">
            <h2>{approved && differsFromAgent ? "Approved quote" : previewing ? "Quote preview" : "Quote"}</h2>
            {differsFromAgent && run.quote?.lines.length ? (
              <span className="hint">
                Agent drafted {formatSek(run.quote.totalExclVatSek)} at {run.quote.discountPct}%
              </span>
            ) : null}
          </div>
          <QuoteView quote={shownQuote} />
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Email to customer</h2>
            <div className="head-actions">
              {previewing && <span className="hint">Preview with your changes</span>}
              <CopyButton text={shownEmail} />
            </div>
          </div>
          <pre className="email">{shownEmail}</pre>
        </section>
      </div>

      <ReviewPanel
        run={run}
        draftLines={draftLines}
        kg={kg}
        onKgChange={(sku, value) => setKg({ ...kg, [sku]: value })}
        discount={discount}
        onDiscountChange={setDiscount}
        volumePct={volumeDiscountPct(preview.totalKg)}
        changed={changed}
        blocker={blocker}
        onDecide={decide}
        onSent={() => setRun({ ...run, sentAt: new Date().toISOString() })}
      />
    </>
  );
}
