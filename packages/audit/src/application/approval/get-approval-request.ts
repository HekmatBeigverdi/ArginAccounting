import type {
  ApprovalRequest
} from "../../domain/approval/approval-request";

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
  const request = await context.approvalRepository.findById(
    approvalRequestId
  );

  if (request === null) {
    throw new ApprovalNotFoundError(
      approvalRequestId
    );
  }

  return request;
}
