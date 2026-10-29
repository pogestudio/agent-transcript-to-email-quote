import type { Status } from "../lib/types";

export const STATUS_LABEL: Record<Status, string> = {
  ready_for_review: "Ready for review",
  needs_approval: "Needs approval",
  needs_info: "Needs info",
};

export default function StatusBadge({ status, large = false }: { status: Status; large?: boolean }) {
  return <span className={`badge badge-${status}${large ? " badge-lg" : ""}`}>{STATUS_LABEL[status]}</span>;
}
