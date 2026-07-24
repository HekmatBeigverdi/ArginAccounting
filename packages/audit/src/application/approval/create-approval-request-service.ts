import type {
  CreateApprovalRequestInput,
  ApprovalRequest
} from "../../domain/approval/approval-request";

import type {
  ApprovalCommandContext
} from "./approval-command-context";

import {
  createApprovalHistoryEntry
} from "./create-approval-history-entry";

import {
  createApprovalRequest
} from "./create-approval-request";

export async function createApprovalRequestService(
  context: ApprovalCommandContext,
  input: CreateApprovalRequestInput
): Promise<ApprovalRequest> {
  const request = createApprovalRequest(
    context,
    input
  );

  const history = createApprovalHistoryEntry(
    context,
    request.id,
    {
      action: "create",
      fromStatus: null,
      toStatus: "draft",
      actor: request.requestedBy,
      occurredAt: request.createdAt
    }
  );

  await context.approvalRepository.create(request);
  await context.approvalRepository.addHistory(history);

  return {
    ...request,
    history: [history]
  };
}
