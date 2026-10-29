import EvalResults from "../../components/EvalResults";
import SuiteForm from "../../components/SuiteForm";
import { activePromptVersion, listPromptVersions } from "../../lib/agent";
import { DEFAULT_K, listBatches, loadCases, MAX_K, readBatch, summarize } from "../../lib/evals";

export default async function EvalsPage({ searchParams }: { searchParams: Promise<{ batch?: string }> }) {
  const { batch } = await searchParams;
  const cases = loadCases();
  const batches = listBatches();
  const selected = readBatch(batch ?? batches[0]?.batch ?? "");

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h1>Evals</h1>
          <span className="muted small">Run every test case k times and grade each run in code</span>
        </div>
        <SuiteForm
          versions={listPromptVersions()}
          active={activePromptVersion()}
          defaultK={DEFAULT_K}
          maxK={MAX_K}
          caseCount={cases.length}
          busy={batches.some((b) => b.status === "running")}
        />
      </section>
      {selected ? (
        <EvalResults
          key={selected.batch}
          cases={cases}
          batches={batches}
          initial={{ ...selected, summary: summarize(selected.results, selected.k) }}
        />
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
