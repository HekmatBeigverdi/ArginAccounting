import type { ApprovalAction } from "../../domain/approval/approval-action.ts";
import type { ApprovalActor } from "../../domain/approval/approval-actor.ts";
import type { ApprovalRequest } from "../../domain/approval/approval-request.ts";
import { resolveApprovalTransition } from "../../domain/approval/approval-transition.ts";
import { validateApprovalAction } from "../../validation/approval/validate-approval-action.ts";
import {
  auditPermissions,
  requireAuditPermission,
  type AuditPermissionCode
} from "../audit-permissions.ts";
import type { ApprovalCommandContext } from "./approval-command-context.ts";
import {
  ApprovalInvalidTransitionError,
  ApprovalNotFoundError
} from "./approval-application-errors.ts";
import { createApprovalAuditEntry } from "./create-approval-audit-entry.ts";
import { createApprovalHistoryEntry } from "./create-approval-history-entry.ts";

export interface ApplyApprovalActionCommand {
  approvalRequestId: string;
  action: Exclude<ApprovalAction, "create">;
  actor: ApprovalActor;
  comment?: string | null;
  correlationId?: string | null;
}

const permissionByAction: Record<ApplyApprovalActionCommand["action"], AuditPermissionCode> = {
  submit: auditPermissions.approvalsSubmit,
  approve: auditPermissions.approvalsApprove,
  reject: auditPermissions.approvalsReject,
  "return-to-draft": auditPermissions.approvalsReturnToDraft,
  cancel: auditPermissions.approvalsCancel,
  comment: auditPermissions.approvalsComment
};

function applyStatusFields(
  request: ApprovalRequest,
  command: ApplyApprovalActionCommand,
  occurredAt: string,
  nextStatus: ApprovalRequest["status"]
): ApprovalRequest {
  const comment = command.comment?.trim() || null;
  if (command.action === "comment") return { ...request, updatedAt: occurredAt };
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
    decidedBy: { ...command.actor, displayName: command.actor.displayName.trim() },
    decidedAt: occurredAt,
    decisionComment: comment,
    updatedAt: occurredAt
  };
}

export async function applyApprovalAction(
  context: ApprovalCommandContext,
  command: ApplyApprovalActionCommand
): Promise<ApprovalRequest> {
  await requireAuditPermission(context.authorizer, permissionByAction[command.action]);
  const requestId = command.approvalRequestId.trim();

  return context.unitOfWork.transaction(async (repositories) => {
    const request = await repositories.approval.findById(requestId);
    if (request === null) throw new ApprovalNotFoundError(requestId);

    const nextStatus = command.action === "comment"
      ? request.status
      : resolveApprovalTransition(request.status, command.action);
    if (nextStatus === null) {
      throw new ApprovalInvalidTransitionError(request.id, request.status, command.action);
    }

    validateApprovalAction({
      currentStatus: request.status,
      action: command.action,
      actor: command.actor,
      ...(command.comment !== undefined ? { comment: command.comment } : {})
    });

    const occurredAt = context.clock.now();
    const changed = applyStatusFields(request, command, occurredAt, nextStatus);
    const updated = await repositories.approval.update(changed);
    const history = createApprovalHistoryEntry(context, request.id, {
      action: command.action,
      fromStatus: request.status,
      toStatus: nextStatus,
      actor: command.actor,
      ...(command.comment !== undefined ? { comment: command.comment } : {}),
      occurredAt
    });
    const completedRequest: ApprovalRequest = {
      ...updated,
      history: [...request.history, history]
    };
    const auditEntry = createApprovalAuditEntry(context, {
      action: command.action,
      source: context.auditSource,
      actor: command.actor,
      request: completedRequest,
      previousRequest: request,
      occurredAt,
      comment: command.comment ?? null,
      correlationId: command.correlationId ?? null
    });

    await repositories.approval.addHistory(history);
    await repositories.audit.create(auditEntry);
    return completedRequest;
  });
}
