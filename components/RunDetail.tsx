"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import CopyButton from "./CopyButton";
import MemoryUsed from "./MemoryUsed";
import QuoteView from "./QuoteView";
import ReviewPanel, { type Decision, type DraftLine } from "./ReviewPanel";
import RunChanges from "./RunChanges";
import StageBadge from "./StageBadge";
import StatusBadge from "./StatusBadge";
import { findProduct } from "../lib/catalog";
import type { Change } from "../lib/diff";
import { formatDateTime, formatSek } from "../lib/format";
import { computeQuote, discountPct as volumeDiscountPct } from "../lib/pricing";
import { approvedEmail } from "../lib/review";
import { stageOf } from "../lib/stage";
import type { Run, Status } from "../lib/types";

type Props = {
  run: Run;
  changes: Change[] | null;               // vs the parent run; null when this run has no parent
  reruns: { id: string; createdAt: string }[];
  activeMemoryIds: string[];
  evalCaseId: string | null;
};

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

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json();
  if (!res.ok) throw new Error(out.error ?? `Request failed (${res.status})`);
  return out;
}

// The preview uses the same pricing and email code as the review route, so what is saved is what was shown.
export default function RunDetail({ run: savedRun, changes, reruns, activeMemoryIds, evalCaseId }: Props) {
  const router = useRouter();
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

  const approved = run.review?.action === "approve";
  const previewing = !run.review && changed;
  const shownQuote = approved ? (run.editedQuote ?? run.quote) : previewing ? preview : run.quote;
  const shownEmail = approved ? (run.editedEmail ?? run.email) : previewing ? approvedEmail(run, preview) : run.email;
  const differsFromAgent = shownQuote !== run.quote;

  async function decide(decision: Decision) {
    const approving = decision.action === "approve";
    const out = await post(`/api/runs/${run.id}/review`, {
      ...decision,
      ...(approving && linesChanged ? { editedLines: lines } : {}),
      ...(approving && override !== null ? { discountPct: override } : {}),
    });
    setRun(out.run);
    if (out.newRunId) router.push(`/runs/${out.newRunId}`);
  }

  async function markSent() {
    setRun((await post(`/api/runs/${run.id}/sent`, {})).run);
  }

  async function addToEval(status: Status): Promise<string> {
    return (await post(`/api/runs/${run.id}/to-eval`, { status })).id;
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
          {run.parentId && (
            <span>
              Rerun of <Link href={`/runs/${run.parentId}`}>{run.parentId}</Link>
            </span>
          )}
          {reruns.map((r) => (
            <span key={r.id}>
              Rerun as <Link href={`/runs/${r.id}`}>{r.id}</Link>
            </span>
          ))}
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

      {run.memoryUsed.length > 0 && (
        <MemoryUsed customer={run.customer} memories={run.memoryUsed} activeIds={activeMemoryIds} />
      )}

      {run.parentId && changes && <RunChanges parentId={run.parentId} changes={changes} />}

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
        reruns={reruns}
        evalCaseId={evalCaseId}
        onDecide={decide}
        onSent={markSent}
        onAddToEval={addToEval}
      />
    </>
  );
}
