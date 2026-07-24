import type {
  ApprovalQuery,
  ApprovalQueryResult
} from "../../domain/approval/approval-query";

import type {
  ApprovalRequestSummary
} from "../../domain/approval/approval-request-summary";

import type {
  ApprovalRepository
} from "../../contracts/approval-repository";

export function searchApprovalRequests(
  approvalRepository: ApprovalRepository,
  query: ApprovalQuery
): Promise<
  ApprovalQueryResult<ApprovalRequestSummary>
> {
  return approvalRepository.search(query);
}
