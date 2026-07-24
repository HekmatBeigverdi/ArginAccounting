import type {
  ApprovalQuery,
  ApprovalQueryResult
} from "../../domain/approval/approval-query";

import type {
  ApprovalRequestSummary
} from "../../domain/approval/approval-request-summary";

import {
  auditPermissions,
  requireAuditPermission
} from "../audit-permissions";

import type {
  ApprovalCommandContext
} from "./approval-command-context";

export async function searchApprovalRequests(
  context: ApprovalCommandContext,
  query: ApprovalQuery
): Promise<ApprovalQueryResult<ApprovalRequestSummary>> {
  await requireAuditPermission(
    context.authorizer,
    auditPermissions.approvalsView
  );

  return context.approvalRepository.search(query);
}
