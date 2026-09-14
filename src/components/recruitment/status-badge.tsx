import { Chip } from "@heroui/react";

import { CANDIDATE_STATUS_DETAILS } from "@/config/recruitment";
import type { CandidateStatusId, StatusTone } from "@/types/recruitment";

const toneToColor: Record<
  StatusTone,
  "default" | "success" | "warning" | "danger"
> = {
  neutral: "default",
  success: "success",
  warning: "warning",
  danger: "danger",
};

/**
 * Human-readable status label for a candidate status. The mapping lives in
 * config/recruitment.ts so wording stays consistent everywhere.
 */
export function StatusBadge({ status }: { status: CandidateStatusId }) {
  const definition = CANDIDATE_STATUS_DETAILS[status];
  return (
    <Chip color={toneToColor[definition.tone]} variant="soft" size="sm">
      {definition.label}
    </Chip>
  );
}
