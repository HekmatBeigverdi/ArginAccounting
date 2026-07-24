import type {
  ApprovalRequest
} from "../../domain/approval/approval-request";

import {
  auditPermissions,
  requireAuditPermission
} from "../audit-permissions";

import type {
  ApprovalCommandContext
} from "./approval-command-context";

import {
  ApprovalNotFoundError
} from "./approval-application-errors";

export async function getApprovalRequest(
  context: ApprovalCommandContext,
  approvalRequestId: string
): Promise<ApprovalRequest> {
  await requireAuditPermission(
    context.authorizer,
    auditPermissions.approvalsView
  );

  const request = await context.approvalRepository.findById(
    approvalRequestId
  );

  if (request === null) {
    throw new ApprovalNotFoundError(approvalRequestId);
  }

  return request;
}
