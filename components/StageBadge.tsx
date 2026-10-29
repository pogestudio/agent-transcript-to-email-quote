import { STAGE_LABEL, type Stage } from "../lib/stage";

export default function StageBadge({ stage, large = false }: { stage: Stage; large?: boolean }) {
  return <span className={`badge stage-${stage}${large ? " badge-lg" : ""}`}>{STAGE_LABEL[stage]}</span>;
}
