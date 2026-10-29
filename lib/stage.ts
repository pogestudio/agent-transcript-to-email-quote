import type { Run } from "./types";

// Where a run is in its life. Separate from Status, which is the agent's verdict that the evals grade.
export type Stage =
  | "to_review" | "needs_manager" | "waiting_on_customer"
  | "ready_to_send" | "sent" | "rejected" | "replaced";

export const STAGE_LABEL: Record<Stage, string> = {
  to_review: "To review",
  needs_manager: "Needs manager",
  waiting_on_customer: "Waiting on customer",
  ready_to_send: "Ready to send",
  sent: "Sent",
  rejected: "Rejected",
  replaced: "Replaced",
};

export function stageOf(run: Run): Stage {
  if (run.sentAt) return "sent";
  if (run.review?.action === "approve") return "ready_to_send";
  if (run.review?.action === "reject") return "rejected";
  if (run.review?.action === "rerun") return "replaced";
  if (run.status === "needs_approval") return "needs_manager";
  if (run.status === "needs_info") return "waiting_on_customer";
  return "to_review";
}
