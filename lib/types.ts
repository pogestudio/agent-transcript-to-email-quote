export type Status = "ready_for_review" | "needs_approval" | "needs_info";

// The ONLY thing the model produces. No prices anywhere.
export type Extraction = {
  customer: string | null;
  currency: string;                       // "SEK" unless the customer asked for another
  lines: { sku: string; kg: number | null; evidence: string }[]; // kg null = unclear; evidence = transcript words
  notInCatalog: string[];                 // asked for, but search found nothing
  requestedDiscountPct: number | null;    // recorded, never applied
  questions: string[];                    // only when something is genuinely unclear
  deliveryNote: string | null;            // e.g. "Delivery on Tuesday"; never a price
};

export type QuoteLine = { sku: string; name: string; kg: number; unitPriceSek: number;
  lineSek: number; minKg: number; belowMin: boolean };
export type Fx = { currency: string; rate: number; rateDate: string; fetchedAt: string; source: string };
export type Quote = {
  lines: QuoteLine[]; totalKg: number; subtotalSek: number;
  discountPct: number;                    // volume tier, or a manager override
  discountSek: number; goodsAfterDiscountSek: number;
  deliverySek: number; totalExclVatSek: number; vatSek: number; totalInclVatSek: number;
  fx: (Fx & { totalExclVat: number; totalInclVat: number }) | null;
  fxError: string | null;
};

export type Memory = { id: string; note: string; createdAt: string; expiresAt: string; sourceRunId: string };
export type Review = {
  action: "approve" | "reject" | "rerun";            // approve takes whatever the reviewer left in the panel
  reason: string;                         // required to reject, optional to approve; never classified
  asManager?: boolean; remember?: string; customerAnswers?: string;
  editedLines?: { sku: string; kg: number }[];
  discountPct?: number;                   // manager override; never stored as a memory
  at: string;
};

export type Run = {
  id: string; createdAt: string;
  source: "ui" | "eval"; batch?: string; caseId?: string; parentId?: string;
  transcript: string; customer: string | null; fxFail: boolean;
  promptVersion: string; memoryUsed: Memory[];
  extraction: Extraction | null;
  blockedSkus: string[];                  // SKUs the model proposed that aren't in the catalog
  quote: Quote | null; status: Status; reasons: string[]; questions: string[]; email: string;
  error: string | null;
  totals: { steps: number; inputTokens: number; outputTokens: number; costUsd: number; ms: number };
  review?: Review; editedQuote?: Quote; editedEmail?: string; sentAt?: string;
};

export type TraceEvent = { runId: string; ts: string; step: number;
  kind: "llm" | "tool" | "end" | "error"; [key: string]: unknown };
