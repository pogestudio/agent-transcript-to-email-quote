"use client";

import Link from "next/link";
import { useState } from "react";
import { STATUS_LABEL } from "./StatusBadge";
import { formatDateTime } from "../lib/format";
import { STATUSES } from "../lib/status";
import type { Review, Run, Status } from "../lib/types";

export type DraftLine = { sku: string; name: string; minKg: number; kg: number | null };
export type Decision = { action: Review["action"]; reason: string; remember: string; customerAnswers: string };

type Props = {
  run: Run;
  draftLines: DraftLine[];
  kg: Record<string, string>;
  onKgChange: (sku: string, value: string) => void;
  discount: string;
  onDiscountChange: (value: string) => void;
  volumePct: number;          // the standard discount for the kg currently in the panel
  changed: boolean;
  blocker: string | null;     // why approving isn't possible right now
  reruns: { id: string; createdAt: string }[];
  evalCaseId: string | null;  // the eval case made from this run, if any
  onDecide: (decision: Decision) => Promise<void>;     // these throw with the server's message
  onSent: () => Promise<void>;
  onAddToEval: (status: Status) => Promise<string>;    // returns the new case id
};

type Busy = Review["action"] | "sent" | "eval" | null;

function reviewLabel(review: Review): string {
  if (review.action === "reject") return "Rejected";
  if (review.action === "rerun") return "Rerun";
  const who = review.asManager ? "Manager approved" : "Approved";
  return review.editedLines || review.discountPct !== undefined ? `${who} with changes` : who;
}

export default function ReviewPanel(props: Props) {
  const { run, draftLines, kg, onKgChange, discount, onDiscountChange, volumePct, changed, blocker } = props;
  const [reason, setReason] = useState("");
  const [remember, setRemember] = useState("");
  const [answers, setAnswers] = useState("");
  const [evalStatus, setEvalStatus] = useState<Status>(run.status);
  const [caseId, setCaseId] = useState(props.evalCaseId);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  const isManager = run.status === "needs_approval";
  const requestedPct = run.extraction?.requestedDiscountPct ?? null;
  const approveLabel = `${isManager ? "Manager approve" : "Approve"}${changed ? " with changes" : ""}`;

  async function act(key: Busy, work: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  // A reason is only required to reject; approving takes whatever is in the panel.
  function submit(action: Decision["action"]) {
    if (action === "reject" && !reason.trim()) return setError("Add a reason to reject.");
    act(action, () =>
      props.onDecide({ action, reason: reason.trim(), remember: remember.trim(), customerAnswers: answers.trim() }),
    );
  }

  if (run.source === "eval") {
    return (
      <section className="card">
        <div className="card-head">
          <h2>Review</h2>
        </div>
        <p className="hint">
          An eval run from batch <Link href={`/evals?batch=${run.batch}`}>{run.batch}</Link>, case {run.caseId}. Eval runs
          are graded by the suite, not reviewed.
        </p>
      </section>
    );
  }

  if (run.review) {
    const { review } = run;
    const approved = review.action === "approve";
    return (
      <section className="card">
        <div className="card-head">
          <h2>Review</h2>
        </div>
        <div className={`review-record record-${review.action}`}>
          <strong>{reviewLabel(review)}</strong>
          <span className="small">
            {formatDateTime(review.at)}
            {review.discountPct !== undefined && ` · ${review.discountPct}% discount`}
          </span>
          {review.reason && <span>{review.reason}</span>}
        </div>
        {review.remember && (
          <p className="review-note">
            <span className="label">Remembered for {run.customer}</span> {review.remember}
          </p>
        )}
        {review.customerAnswers && (
          <p className="review-note">
            <span className="label">Customer answers</span> {review.customerAnswers}
          </p>
        )}
        {review.action === "rerun" &&
          props.reruns.map((r) => (
            <p key={r.id} className="review-note">
              <span className="label">New draft</span> <Link href={`/runs/${r.id}`}>{r.id}</Link>
            </p>
          ))}
        {approved && !run.sentAt && (
          <div className="review-actions">
            <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => act("sent", props.onSent)}>
              {busy === "sent" ? "Saving…" : "Mark as sent"}
            </button>
            <span className="hint">Copy the email above, send it from your mail, then mark it as sent.</span>
          </div>
        )}
        {run.sentAt && (
          <div className="review-record record-sent">
            <strong>Sent</strong>
            <span className="small">{formatDateTime(run.sentAt)}</span>
          </div>
        )}
        {approved && (
          <div className="review-actions">
            {caseId ? (
              <span className="hint">
                In the eval set as {caseId}. See the <Link href="/evals">Evals page</Link>.
              </span>
            ) : (
              <>
                <select
                  className="inline-select"
                  aria-label="Expected status"
                  value={evalStatus}
                  onChange={(e) => setEvalStatus(e.target.value as Status)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      Expect {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn"
                  disabled={busy !== null}
                  onClick={() => act("eval", async () => setCaseId(await props.onAddToEval(evalStatus)))}
                >
                  {busy === "eval" ? "Adding…" : "Add to eval set"}
                </button>
                <span className="hint">The approved lines and this status become a new case.</span>
              </>
            )}
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Review</h2>
        <span className="hint">Changes update the quote and email above</span>
      </div>

      <div className="review-grid">
        <div className="field">
          <span className="label">Quantities</span>
          {draftLines.length === 0 ? (
            <p className="hint">No product lines to edit.</p>
          ) : (
            <div className="kg-list">
              {draftLines.map((line) => (
                <label key={line.sku} className="kg-row">
                  <span>
                    {line.name}
                    <span className="sku">
                      {line.sku} · min {line.minKg} kg
                    </span>
                  </span>
                  <span className="unit-input">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={kg[line.sku]}
                      placeholder="?"
                      onChange={(e) => onKgChange(line.sku, e.target.value.trim())}
                    />
                    kg
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {isManager && (
          <label className="field">
            <span className="label">Discount</span>
            <span className="unit-input">
              <input
                type="text"
                inputMode="numeric"
                value={discount}
                placeholder={String(volumePct)}
                onChange={(e) => onDiscountChange(e.target.value.trim())}
              />
              %
            </span>
            <span className="hint">
              Standard for this order is {volumePct}%.
              {requestedPct !== null && ` The customer asked for ${requestedPct}%.`} Leave empty to keep the standard.
            </span>
          </label>
        )}
      </div>

      <label className="field review-reason">
        <span className="label">Reason</span>
        <span className="hint">Enter reason for approval, edit or reject. Optional when approving.</span>
        <textarea className="reason-box" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>

      <div className="review-grid review-extra">
        <label className="field">
          <span className="label">Remember for this customer</span>
          <input
            type="text"
            value={remember}
            disabled={!run.customer}
            placeholder={run.customer ? "Always wants delivery on Tuesdays" : ""}
            onChange={(e) => setRemember(e.target.value)}
          />
          <span className="hint">
            {run.customer
              ? `A lasting preference, used on ${run.customer}'s next runs. Never prices or discounts.`
              : "This run has no customer name, so nothing can be remembered."}
          </span>
        </label>
        {run.status === "needs_info" && (
          <label className="field">
            <span className="label">Customer answers</span>
            <textarea className="reason-box" rows={2} value={answers} onChange={(e) => setAnswers(e.target.value)} />
            <span className="hint">Added to the transcript as a follow-up when you rerun.</span>
          </label>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="review-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={blocker !== null || busy !== null}
          onClick={() => submit("approve")}
        >
          {busy === "approve" ? "Saving…" : approveLabel}
        </button>
        <button type="button" className="btn" disabled={busy !== null} onClick={() => submit("reject")}>
          {busy === "reject" ? "Saving…" : "Reject"}
        </button>
        <button type="button" className="btn" disabled={busy !== null} onClick={() => submit("rerun")}>
          {busy === "rerun" ? "Rerunning…" : "Rerun"}
        </button>
        {blocker && <span className="hint">{blocker}</span>}
      </div>
      <p className="hint preview-note">
        Rerun reads the call again with the customer answers and the customer&apos;s memory. The kg and discount fields
        only apply to an approval.
      </p>
    </section>
  );
}
