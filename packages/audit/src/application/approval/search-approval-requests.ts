import type {
  ApprovalQuery,
  ApprovalQueryResult
} from "../../domain/approval/approval-query.ts";

import type {
  ApprovalRequestSummary
} from "../../domain/approval/approval-request-summary.ts";

import {
  auditPermissions,
  requireAuditPermission
} from "../audit-permissions.ts";

import type {
  ApprovalCommandContext
} from "./approval-command-context.ts";

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
