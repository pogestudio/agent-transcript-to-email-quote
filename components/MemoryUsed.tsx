"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDay } from "../lib/format";
import type { Memory } from "../lib/types";

type Props = {
  customer: string | null;
  memories: Memory[];         // the notes this run was given
  activeIds: string[];        // the ones the customer's memory still holds
};

// Forget deletes a note from the customer's memory. The run keeps its record of what it used.
export default function MemoryUsed({ customer, memories, activeIds }: Props) {
  const [active, setActive] = useState(activeIds);
  const [error, setError] = useState<string | null>(null);

  async function forget(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/memory?${new URLSearchParams({ customer: customer ?? "", id })}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Could not forget the note (${res.status})`);
      setActive(active.filter((a) => a !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Memory used</h2>
        <span className="hint">Notes from earlier reviews of {customer}</span>
      </div>
      <ul className="memory-list">
        {memories.map((m) => (
          <li key={m.id} className="memory-row">
            <span>
              {m.note}
              <span className="sku">
                From <Link href={`/runs/${m.sourceRunId}`}>{m.sourceRunId}</Link> · expires {formatDay(m.expiresAt.slice(0, 10))}
              </span>
            </span>
            {active.includes(m.id) ? (
              <button type="button" className="btn btn-sm" onClick={() => forget(m.id)}>
                Forget
              </button>
            ) : (
              <span className="hint">No longer remembered</span>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
