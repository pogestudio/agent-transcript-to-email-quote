import Link from "next/link";
import StageBadge from "./StageBadge";
import { formatDateTime, formatMoney, formatSek } from "../lib/format";
import { stageOf, type Stage } from "../lib/stage";
import type { Run } from "../lib/types";

const VIEWS: { key: string; label: string; stages: Stage[] | null }[] = [
  { key: "all", label: "All", stages: null },
  { key: "todo", label: "To do", stages: ["to_review", "needs_manager", "waiting_on_customer"] },
  { key: "ready", label: "Ready to send", stages: ["ready_to_send"] },
  { key: "sent", label: "Sent", stages: ["sent"] },
  { key: "rejected", label: "Rejected", stages: ["rejected"] },
];

const inView = (run: Run, stages: Stage[] | null) => stages === null || stages.includes(stageOf(run));

export default function Inbox({ runs, view }: { runs: Run[]; view: string | undefined }) {
  const active = VIEWS.find((v) => v.key === view) ?? VIEWS[0];
  const shown = runs.filter((r) => inView(r, active.stages));

  return (
    <section className="card">
      <div className="card-head">
        <h2>Inbox</h2>
        <nav className="filters" aria-label="Filter by stage">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={v.key === "all" ? "/" : `/?view=${v.key}`}
              className="filter"
              aria-current={v === active ? "true" : undefined}
              scroll={false}
            >
              {v.label}
              <span className="filter-count">{runs.filter((r) => inView(r, v.stages)).length}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="inbox">
        <div className="inbox-row inbox-head" aria-hidden="true">
          <span className="c-time">Time</span>
          <span className="c-customer">Customer</span>
          <span className="c-stage">Stage</span>
          <span className="c-total">Total excl. VAT</span>
        </div>
        {shown.length === 0 && <p className="empty">Nothing here.</p>}
        {shown.map((run) => {
          const quote = run.editedQuote ?? run.quote;
          return (
            <Link key={run.id} href={`/runs/${run.id}`} className="inbox-row">
              <span className="c-time">{formatDateTime(run.createdAt)}</span>
              <span className="c-customer">{run.customer ?? "Unknown customer"}</span>
              <span className="c-stage">
                <StageBadge stage={stageOf(run)} />
              </span>
              <span className="c-total">
                {quote?.lines.length ? formatSek(quote.totalExclVatSek) : <span className="muted">Not priced</span>}
                {quote?.fx && <span className="c-total-fx">{formatMoney(quote.fx.totalExclVat, quote.fx.currency)}</span>}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
