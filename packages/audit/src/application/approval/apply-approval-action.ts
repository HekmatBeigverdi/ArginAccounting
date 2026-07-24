import type {
  ApprovalAction
} from "../../domain/approval/approval-action";

import type {
  ApprovalActor
} from "../../domain/approval/approval-actor";

import type {
  ApprovalRequest
} from "../../domain/approval/approval-request";

import {
  resolveApprovalTransition
} from "../../domain/approval/approval-transition";

import {
  validateApprovalAction
} from "../../validation/approval/validate-approval-action";

import type {
  ApprovalCommandContext
} from "./approval-command-context";

import {
  ApprovalInvalidTransitionError,
  ApprovalNotFoundError
} from "./approval-application-errors";

import {
  createApprovalAuditEntry
} from "./create-approval-audit-entry";

import {
  createApprovalHistoryEntry
} from "./create-approval-history-entry";

export interface ApplyApprovalActionCommand {
  approvalRequestId: string;
  action: Exclude<ApprovalAction, "create">;
  actor: ApprovalActor;
  comment?: string | null;
  correlationId?: string | null;
}

function applyStatusFields(
  request: ApprovalRequest,
  command: ApplyApprovalActionCommand,
  occurredAt: string,
  nextStatus: ApprovalRequest["status"]
): ApprovalRequest {
  const comment = command.comment?.trim() || null;

  if (command.action === "comment") {
    return {
      ...request,
      updatedAt: occurredAt
    };
  }

  if (command.action === "submit") {
    return {
      ...request,
      status: nextStatus,
      requestedAt: occurredAt,
      decidedBy: null,
      decidedAt: null,
      decisionComment: null,
      updatedAt: occurredAt
    };
  }

  if (command.action === "return-to-draft") {
    return {
      ...request,
      status: nextStatus,
      requestedAt: null,
      decidedBy: null,
      decidedAt: null,
      decisionComment: comment,
      updatedAt: occurredAt
    };
  }

  return {
    ...request,
    status: nextStatus,
    decidedBy: {
      ...command.actor,
      displayName: command.actor.displayName.trim()
    },
    decidedAt: occurredAt,
    decisionComment: comment,
    updatedAt: occurredAt
  };
}

export async function applyApprovalAction(
  context: ApprovalCommandContext,
  command: ApplyApprovalActionCommand
): Promise<ApprovalRequest> {
  const requestId = command.approvalRequestId.trim();

  return context.unitOfWork.transaction(
    async (repositories) => {
      const request =
        await repositories.approval.findById(requestId);

      if (request === null) {
        throw new ApprovalNotFoundError(requestId);
      }

      validateApprovalAction({
        currentStatus: request.status,
        action: command.action,
        actor: command.actor,
        ...(command.comment !== undefined
          ? { comment: command.comment }
          : {})
      });

      const nextStatus =
        command.action === "comment"
          ? request.status
          : resolveApprovalTransition(
              request.status,
              command.action
            );

      if (nextStatus === null) {
        throw new ApprovalInvalidTransitionError(
          request.id,
          request.status,
          command.action
        );
      }

      const occurredAt = context.clock.now();
      const changed = applyStatusFields(
        request,
        command,
        occurredAt,
        nextStatus
      );

      const updated =
        await repositories.approval.update(changed);

      const history = createApprovalHistoryEntry(
        context,
        request.id,
        {
          action: command.action,
          fromStatus: request.status,
          toStatus: nextStatus,
          actor: command.actor,
          ...(command.comment !== undefined
            ? { comment: command.comment }
            : {}),
          occurredAt
        }
      );

      const completedRequest: ApprovalRequest = {
        ...updated,
        history: [...request.history, history]
      };

      const auditEntry = createApprovalAuditEntry(
        context,
        {
          action: command.action,
          source: context.auditSource,
          actor: command.actor,
          request: completedRequest,
          previousRequest: request,
          occurredAt,
          comment: command.comment ?? null,
          correlationId: command.correlationId ?? null
        }
      );

      await repositories.approval.addHistory(history);
      await repositories.audit.create(auditEntry);

      return completedRequest;
    }
  );
}
