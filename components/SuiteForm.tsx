"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  versions: string[];
  active: string;
  defaultK: number;
  maxK: number;
  caseCount: number;
  busy: boolean;                          // a batch is running
};

const WHOLE_NUMBER = /^\d+$/;

export default function SuiteForm({ versions, active, defaultK, maxK, caseCount, busy }: Props) {
  const router = useRouter();
  const [version, setVersion] = useState(active);
  const [k, setK] = useState(String(defaultK));
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kOk = WHOLE_NUMBER.test(k) && Number(k) >= 1 && Number(k) <= maxK;

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/evals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptVersion: version, k: Number(k) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Could not start the suite (${res.status})`);
      router.push(`/evals?batch=${body.batch}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  }

  return (
    <form onSubmit={start}>
      <div className="suite-form">
        <label className="field">
          <span className="label">Prompt version</span>
          <select value={version} onChange={(e) => setVersion(e.target.value)}>
            {versions.map((v) => (
              <option key={v} value={v}>
                {v}
                {v === active ? " (active)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Runs per case (k)</span>
          <span className="unit-input">
            <input type="text" inputMode="numeric" value={k} onChange={(e) => setK(e.target.value.trim())} />
          </span>
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy || starting || !kOk}>
          {busy ? "Suite running…" : starting ? "Starting…" : "Run suite"}
        </button>
        <span className="hint">
          {kOk ? `${caseCount} cases × ${k} = ${caseCount * Number(k)} runs` : `k must be a whole number from 1 to ${maxK}`}
        </span>
      </div>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
