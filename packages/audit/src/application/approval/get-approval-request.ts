import type {
  ApprovalRequest
} from "../../domain/approval/approval-request.ts";

import {
  auditPermissions,
  requireAuditPermission
} from "../audit-permissions.ts";

import type {
  ApprovalCommandContext
} from "./approval-command-context.ts";

import {
  ApprovalNotFoundError
} from "./approval-application-errors.ts";

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
