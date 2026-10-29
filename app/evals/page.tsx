import Corrections from "../../components/Corrections";
import EvalResults from "../../components/EvalResults";
import GateCompare from "../../components/GateCompare";
import SuiteForm from "../../components/SuiteForm";
import { activePromptVersion, listPromptVersions } from "../../lib/agent";
import { loadCorrections } from "../../lib/corrections";
import { DEFAULT_K, listBatches, loadCases, MAX_K, readBatch, summarize } from "../../lib/evals";

export default async function EvalsPage({ searchParams }: { searchParams: Promise<{ batch?: string }> }) {
  const { batch } = await searchParams;
  const cases = loadCases();
  const batches = listBatches();
  const selected = readBatch(batch ?? batches[0]?.batch ?? "");
  const active = activePromptVersion();
  // The gate compares a finished batch with another finished one.
  const candidate = selected?.status === "done" ? batches.find((b) => b.batch === selected.batch) : undefined;
  const baselines = batches.filter((b) => b.status === "done" && b.batch !== selected?.batch);

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h1>Evals</h1>
          <span className="muted small">Run every test case k times and grade each run in code</span>
        </div>
        <SuiteForm
          versions={listPromptVersions()}
          active={active}
          defaultK={DEFAULT_K}
          maxK={MAX_K}
          caseCount={cases.length}
          busy={batches.some((b) => b.status === "running")}
        />
      </section>
      {selected ? (
        <>
          <EvalResults
            key={selected.batch}
            cases={cases}
            batches={batches}
            initial={{ ...selected, summary: summarize(selected.results, selected.k) }}
          />
          {candidate && baselines.length > 0 && (
            <GateCompare key={candidate.batch} candidate={candidate} baselines={baselines} cases={cases} active={active} />
          )}
          <Corrections
            corrections={loadCorrections()}
            cases={cases}
            failed={selected.results.filter((r) => !r.pass)}
            k={selected.k}
          />
        </>
      ) : (
        <section className="card">
          <p className="muted">
            {batch ? `No eval batch with id ${batch}.` : "No eval batches yet. Run the suite to make the first one."}
          </p>
        </section>
      )}
    </>
  );
}
