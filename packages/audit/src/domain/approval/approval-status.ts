export const approvalStatuses = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "cancelled"
] as const;

export type ApprovalStatus =
  (typeof approvalStatuses)[number];

export function isApprovalStatus(
  value: string
): value is ApprovalStatus {
  return approvalStatuses.includes(
    value as ApprovalStatus
  );
}
