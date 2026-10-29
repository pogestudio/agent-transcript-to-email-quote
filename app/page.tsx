import Inbox from "../components/Inbox";
import NewRunForm from "../components/NewRunForm";
import { listRuns, listTranscripts } from "../lib/store";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const runs = listRuns("ui");

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h1>New run</h1>
          <span className="muted small">Turn a call transcript into a draft quote</span>
        </div>
        <NewRunForm transcripts={listTranscripts()} />
      </section>
      <Inbox runs={runs} view={view} />
    </>
  );
}
