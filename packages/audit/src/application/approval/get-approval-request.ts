import type {
  ApprovalRequest
} from "../../domain/approval/approval-request";

import type {
  ApprovalRepository
} from "../../contracts/approval-repository";

import {
  ApprovalNotFoundError
} from "./approval-application-errors";

export async function getApprovalRequest(
  approvalRepository: ApprovalRepository,
  approvalRequestId: string
): Promise<ApprovalRequest> {
  const request = await approvalRepository.findById(
    approvalRequestId
  );

  if (request === null) {
    throw new ApprovalNotFoundError(
      approvalRequestId
    );
  }

  return request;
}
