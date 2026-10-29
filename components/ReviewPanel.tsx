"use client";

import { useState } from "react";
import { formatDateTime } from "../lib/format";
import type { Review, Run } from "../lib/types";

export type DraftLine = { sku: string; name: string; minKg: number; kg: number | null };
export type Decision = { action: "approve" | "reject"; reason: string };

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
  onDecide: (decision: Decision) => void;
  onSent: () => void;
};

function reviewLabel(review: Review): string {
  if (review.action === "reject") return "Rejected";
  if (review.action === "rerun") return "Rerun";
  const who = review.asManager ? "Manager approved" : "Approved";
  return review.editedLines || review.discountPct !== undefined ? `${who} with changes` : who;
}

export default function ReviewPanel(props: Props) {
  const { run, draftLines, kg, onKgChange, discount, onDiscountChange, volumePct, changed, blocker, onDecide, onSent } = props;
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isManager = run.status === "needs_approval";
  const requestedPct = run.extraction?.requestedDiscountPct ?? null;
  const approveLabel = `${isManager ? "Manager approve" : "Approve"}${changed ? " with changes" : ""}`;

  // A reason is only required to reject; approving takes whatever is in the panel.
  function submit(action: Decision["action"]) {
    if (action === "reject" && !reason.trim()) return setError("Add a reason to reject.");
    setError(null);
    onDecide({ action, reason: reason.trim() });
  }

  if (run.review) {
    const { review } = run;
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
        {review.action === "approve" && !run.sentAt && (
          <div className="review-actions">
            <button type="button" className="btn btn-primary" onClick={onSent}>
              Mark as sent
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
        <p className="hint preview-note">Preview only: nothing is saved yet, and a refresh resets this page.</p>
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

      {error && <p className="form-error">{error}</p>}

      <div className="review-actions">
        <button type="button" className="btn btn-primary" disabled={blocker !== null} onClick={() => submit("approve")}>
          {approveLabel}
        </button>
        <button type="button" className="btn" onClick={() => submit("reject")}>
          Reject
        </button>
        <button type="button" className="btn" disabled title="Needs the real agent">
          Rerun
        </button>
        {blocker && <span className="hint">{blocker}</span>}
      </div>
      <p className="hint preview-note">Preview only: nothing is saved yet, and a refresh resets this page.</p>
    </section>
  );
}
