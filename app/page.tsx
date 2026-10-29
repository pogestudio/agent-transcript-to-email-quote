import Inbox from "../components/Inbox";
import NewRunForm from "../components/NewRunForm";
import { listJson, listTranscripts } from "../lib/store";
import type { Run } from "../lib/types";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const runs = listJson<Run>("runs")
    .filter((r) => r.source === "ui")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h1>New run</h1>
          <span className="muted small">Turn a call transcript into a draft quote</span>
        </div>
        <NewRunForm
          transcripts={listTranscripts()}
          fakeRuns={runs.map((r) => ({ id: r.id, transcript: r.transcript }))}
        />
      </section>
      <Inbox runs={runs} view={view} />
    </>
  );
}
