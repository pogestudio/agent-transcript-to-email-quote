import Link from "next/link";
import { STATUS_LABEL } from "./StatusBadge";
import type { Change } from "../lib/diff";
import type { Status } from "../lib/types";

const shown = (change: Change, value: string) => (change.field === "Status" ? STATUS_LABEL[value as Status] : value);

export default function RunChanges({ parentId, changes }: { parentId: string; changes: Change[] }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>Changes vs parent</h2>
        <span className="hint">
          Rerun of <Link href={`/runs/${parentId}`}>{parentId}</Link>
        </span>
      </div>
      {changes.length === 0 ? (
        <p className="muted">No differences from the parent run.</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="changes">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Parent</th>
                  <th>This run</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((change) => (
                  <tr key={change.field}>
                    <td>{change.field}</td>
                    <td>{shown(change, change.before)}</td>
                    <td>{shown(change, change.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint preview-note">The email row shows only the lines that differ.</p>
        </>
      )}
    </section>
  );
}
