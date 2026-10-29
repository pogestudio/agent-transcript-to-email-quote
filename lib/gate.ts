import { readBatch, type EvalBatch } from "./evals";

export type CaseDelta = { caseId: string; baseline: number; candidate: number; delta: number };   // passed runs
export type GateResult = {
  ok: boolean;
  dropped: string[];                      // cases that pass fewer runs than in the baseline
  notImproved: string[];                  // targets that don't pass more runs than in the baseline
  invented: number;                       // in the candidate; must be 0
  reasons: string[];                      // why the gate blocks; empty when it passes
};

const passed = (batch: EvalBatch, caseId: string) =>
  batch.results.filter((r) => r.caseId === caseId && r.pass).length;
const underEscalated = (batch: EvalBatch) => batch.results.filter((r) => r.underEscalated).length;

// Passed runs per case in both batches, every case in either, in case id order.
export function compareBatches(baseline: EvalBatch, candidate: EvalBatch): CaseDelta[] {
  const ids = [...new Set([...baseline.results, ...candidate.results].map((r) => r.caseId))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return ids.map((caseId) => {
    const before = passed(baseline, caseId), after = passed(candidate, caseId);
    return { caseId, baseline: before, candidate: after, delta: after - before };
  });
}

// A prompt goes live only when no case got worse, every target got better, nothing was invented
// and no more escalations were missed. One noisy run is enough to block it.
export function gate(baseline: EvalBatch, candidate: EvalBatch, targets: string[]): GateResult {
  const cases = compareBatches(baseline, candidate);
  const inBaseline = new Set(baseline.results.map((r) => r.caseId));
  const row = (id: string) => cases.find((c) => c.caseId === id);
  const runs = (n: number, batch: EvalBatch) => `${n}/${batch.k}`;

  const dropped = cases.filter((c) => c.delta < 0).map((c) => c.caseId);
  // A target the baseline never ran can't show that it improved.
  const notImproved = targets.filter((id) => !inBaseline.has(id) || !((row(id)?.delta ?? 0) > 0));
  const invented = candidate.results.reduce((n, r) => n + r.invented, 0);
  const under = { baseline: underEscalated(baseline), candidate: underEscalated(candidate) };

  const reasons = [
    ...(baseline.k !== candidate.k ? [`k differs: ${baseline.k} in the baseline, ${candidate.k} in this batch`] : []),
    ...(targets.length ? [] : ["Pick at least one target case"]),
    ...dropped.map((id) => {
      const c = row(id)!;
      return `${id} dropped from ${runs(c.baseline, baseline)} to ${runs(c.candidate, candidate)}`;
    }),
    ...notImproved.map((id) => {
      const c = row(id);
      return !inBaseline.has(id) || !c
        ? `${id} is not in the baseline`
        : `${id} did not improve (${runs(c.baseline, baseline)} to ${runs(c.candidate, candidate)})`;
    }),
    ...(invented ? [`${invented} invented ${invented === 1 ? "line" : "lines"}`] : []),
    ...(under.candidate > under.baseline ? [`Under escalations rose from ${under.baseline} to ${under.candidate}`] : []),
  ];
  return { ok: reasons.length === 0, dropped, notImproved, invented, reasons };
}

// The two batches the gate compares, or why it can't: both must exist and be finished.
export function loadPair(a: unknown, b: unknown):
  { baseline: EvalBatch; candidate: EvalBatch } | { error: string; status: number } {
  const baseline = readBatch(String(a ?? "")), candidate = readBatch(String(b ?? ""));
  if (!baseline) return { error: `No eval batch with id ${a}`, status: 404 };
  if (!candidate) return { error: `No eval batch with id ${b}`, status: 404 };
  if (baseline.status !== "done" || candidate.status !== "done") {
    return { error: "Both batches must be finished before they are compared", status: 409 };
  }
  return { baseline, candidate };
}
