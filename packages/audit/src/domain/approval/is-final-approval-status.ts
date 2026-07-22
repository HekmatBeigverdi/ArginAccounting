import type {
  ApprovalStatus
} from "./approval-status";

export function isFinalApprovalStatus(
  status: ApprovalStatus
): boolean {
  return (
    status === "approved" ||
    status === "rejected" ||
    status === "cancelled"
  );
}
