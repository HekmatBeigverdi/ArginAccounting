import type {
  ApprovalQuery,
  ApprovalQueryResult
} from "../../domain/approval/approval-query";

import type {
  ApprovalRequestSummary
} from "../../domain/approval/approval-request-summary";

import type {
  ApprovalCommandContext
} from "./approval-command-context";

export function searchApprovalRequests(
  context: ApprovalCommandContext,
  query: ApprovalQuery
): Promise<
  ApprovalQueryResult<ApprovalRequestSummary>
> {
  return context.approvalRepository.search(query);
}
