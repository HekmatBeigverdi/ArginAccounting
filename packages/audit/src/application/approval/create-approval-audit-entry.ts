import type {
  AuditAction,
  AuditEntry,
  AuditSource
} from "../../index";

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
  createAuditEntry
} from "../audit/create-audit-entry";

import type {
  CreateAuditEntryDependencies
} from "../audit/create-audit-entry";

function resolveAuditAction(
  action: ApprovalAction
): AuditAction {
  if (action === "return-to-draft") {
    return "status-change";
  }

  if (action === "comment") {
    return "update";
  }

  return action;
}

function approvalSnapshot(
  request: ApprovalRequest
) {
  return {
    id: request.id,
    requestType: request.requestType,
    title: request.title,
    status: request.status,
    version: request.version,
    requestedAt: request.requestedAt,
    decidedAt: request.decidedAt,
    decisionComment: request.decisionComment,
    updatedAt: request.updatedAt
  };
}

export interface CreateApprovalAuditEntryInput {
  action: ApprovalAction;
  source: AuditSource;
  actor: ApprovalActor;
  request: ApprovalRequest;
  previousRequest?: ApprovalRequest | null;
  occurredAt: string;
  comment?: string | null;
  correlationId?: string | null;
}

export function createApprovalAuditEntry(
  dependencies: CreateAuditEntryDependencies,
  input: CreateApprovalAuditEntryInput
): AuditEntry {
  return createAuditEntry(
    dependencies,
    {
      occurredAt: input.occurredAt,
      action: resolveAuditAction(input.action),
      source: input.source,
      actor: input.actor,
      scope: input.request.scope,
      target: {
        entityType: "approval-request",
        entityId: input.request.id,
        entityDisplayName: input.request.title
      },
      message:
        input.action === "comment"
          ? "A comment was added to the approval request."
          : `Approval request action '${input.action}' was completed.`,
      reason: input.comment?.trim() || null,
      before: input.previousRequest
        ? approvalSnapshot(input.previousRequest)
        : null,
      after: approvalSnapshot(input.request),
      correlationId: input.correlationId ?? null,
      metadata: {
        approvalAction: input.action,
        approvalStatus: input.request.status
      }
    }
  );
}
