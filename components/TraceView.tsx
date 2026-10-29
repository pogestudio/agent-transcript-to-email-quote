import { STATUS_LABEL } from "./StatusBadge";
import { formatNumber, formatSeconds, formatUsd } from "../lib/format";
import type { Run, Status, TraceEvent } from "../lib/types";

type Usage = { input_tokens: number; output_tokens: number };

const KIND_LABEL: Record<TraceEvent["kind"], string> = {
  llm: "Model",
  tool: "Tool",
  end: "End",
  error: "Error",
};

const json = (value: unknown) => JSON.stringify(value, null, 2);

function describe(event: TraceEvent): string {
  switch (event.kind) {
    case "llm": {
      const usage = event.usage as Usage;
      return `${event.stopReason} · ${formatNumber(usage.input_tokens)} in, ${formatNumber(usage.output_tokens)} out`;
    }
    case "tool":
      return `${event.name}(${JSON.stringify(event.input)})`;
    case "end":
      return `Finished: ${STATUS_LABEL[event.status as Status]}`;
    default:
      return String(event.error ?? "Agent error");
  }
}

function sections(event: TraceEvent): [string, unknown][] {
  if (event.kind === "tool") {
    return [
      ["Input", event.input],
      ["Output", event.output],
    ];
  }
  const { runId: _runId, ts: _ts, step: _step, kind: _kind, ...rest } = event;
  return [["Details", rest]];
}

export default function TraceView({ totals, events }: { totals: Run["totals"]; events: TraceEvent[] }) {
  const stats: [string, string][] = [
    ["Steps", String(totals.steps)],
    ["Input tokens", formatNumber(totals.inputTokens)],
    ["Output tokens", formatNumber(totals.outputTokens)],
    ["Cost", formatUsd(totals.costUsd)],
    ["Time", formatSeconds(totals.ms)],
  ];

  return (
    <>
      <div className="trace-totals">
        {stats.map(([label, value]) => (
          <div key={label} className="stat">
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
          </div>
        ))}
      </div>

      {events.length === 0 ? (
        <p className="muted">No trace events for this run.</p>
      ) : (
        <div className="trace-events">
          {events.map((event, i) => (
            <details key={i} className="event">
              <summary>
                <div className="event-line">
                  <span className="event-step">Step {event.step}</span>
                  <span className={`kind kind-${event.kind}`}>{KIND_LABEL[event.kind]}</span>
                  <span className="event-text">
                    {describe(event)}
                    {event.isError === true && <span className="event-failed">failed</span>}
                  </span>
                  <span className="event-ms">{typeof event.ms === "number" ? `${formatNumber(event.ms)} ms` : ""}</span>
                </div>
              </summary>
              <div className="event-body">
                {sections(event).map(([label, value]) => (
                  <div key={label}>
                    <div className="label">{label}</div>
                    <pre className="code">{json(value)}</pre>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}

      <details className="raw">
        <summary>Raw JSONL</summary>
        <pre className="code">{events.map((event) => JSON.stringify(event)).join("\n")}</pre>
      </details>
    </>
  );
}
