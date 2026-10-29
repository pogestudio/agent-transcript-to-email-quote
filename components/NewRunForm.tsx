"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  transcripts: { name: string; text: string }[];
  fakeRuns: { id: string; transcript: string }[];
};

const FAKE_RUN_MS = 900;

export default function NewRunForm({ transcripts, fakeRuns }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [transcript, setTranscript] = useState("");
  const [customer, setCustomer] = useState("");
  const [fxFail, setFxFail] = useState(false);
  const [running, setRunning] = useState(false);

  function pick(name: string) {
    setSelected(name);
    setTranscript(transcripts.find((t) => t.name === name)?.text ?? "");
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setSelected("");
    setTranscript(await file.text());
  }

  // Fake until POST /api/run exists: open the canned run for this transcript, or the newest one.
  function run(event: React.FormEvent) {
    event.preventDefault();
    setRunning(true);
    const match = fakeRuns.find((r) => r.transcript.trim() === transcript.trim()) ?? fakeRuns[0];
    setTimeout(() => router.push(`/runs/${match.id}`), FAKE_RUN_MS);
  }

  return (
    <form className="run-form" onSubmit={run}>
      <div className="run-form-row">
        <label className="field">
          <span className="label">Transcript</span>
          <select value={selected} onChange={(e) => pick(e.target.value)}>
            <option value="">Pick a test transcript…</option>
            {transcripts.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Or upload a .txt file</span>
          <input type="file" accept=".txt,text/plain" onChange={(e) => upload(e.target.files?.[0])} />
        </label>
      </div>

      <label className="field">
        <span className="label">Call transcript</span>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder={"SA: Kvarn Kaffe, Sara här.\nC: Hej! …"}
          spellCheck={false}
        />
      </label>

      <div className="run-form-row">
        <label className="field">
          <span className="label">Customer name</span>
          <input type="text" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Café Linnea" />
        </label>
        <div className="run-form-actions">
          <label className="check">
            <input type="checkbox" checked={fxFail} onChange={(e) => setFxFail(e.target.checked)} />
            Simulate FX failure
          </label>
          <button type="submit" className="btn btn-primary" disabled={running || !transcript.trim()}>
            {running ? "Running…" : "Run"}
          </button>
        </div>
      </div>
    </form>
  );
}
