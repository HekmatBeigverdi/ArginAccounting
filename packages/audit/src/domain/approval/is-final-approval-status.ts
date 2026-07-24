import type {
  ApprovalStatus
} from "./approval-status.ts";

export function isFinalApprovalStatus(
  status: ApprovalStatus
): boolean {
  return (
    status === "approved" ||
    status === "rejected" ||
    status === "cancelled"
  );
}
