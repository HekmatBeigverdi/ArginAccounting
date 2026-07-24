import type {
  CreateApprovalRequestInput,
  ApprovalRequest
} from "../../domain/approval/approval-request";

import type {
  ApprovalCommandContext
} from "./approval-command-context";

import {
  createApprovalAuditEntry
} from "./create-approval-audit-entry";

import {
  createApprovalHistoryEntry
} from "./create-approval-history-entry";

import {
  createApprovalRequest
} from "./create-approval-request";

export interface CreateApprovalRequestCommand
extends CreateApprovalRequestInput {
  correlationId?: string | null;
}

export async function createApprovalRequestService(
  context: ApprovalCommandContext,
  input: CreateApprovalRequestCommand
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

  const completedRequest: ApprovalRequest = {
    ...request,
    history: [history]
  };

  const auditEntry = createApprovalAuditEntry(
    context,
    {
      action: "create",
      source: context.auditSource,
      actor: request.requestedBy,
      request: completedRequest,
      occurredAt: request.createdAt,
      correlationId: input.correlationId ?? null
    }
  );

  return context.unitOfWork.transaction(
    async (repositories) => {
      await repositories.approval.create(request);
      await repositories.approval.addHistory(history);
      await repositories.audit.create(auditEntry);

      return completedRequest;
    }
  );
}
