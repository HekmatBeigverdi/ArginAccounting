import type {
  ApprovalRequest,
  CreateApprovalRequestInput
} from "../../domain/approval/approval-request.ts";

import {
  initialApprovalRequestVersion
} from "../../domain/approval/approval-request.ts";

import {
  emptyApprovalScope
} from "../../domain/approval/approval-scope.ts";

import type {
  AuditClock
} from "../../contracts/audit-clock.ts";

import type {
  AuditIdGenerator
} from "../../contracts/audit-id-generator.ts";

import {
  validateApprovalRequestInput
} from "../../validation/approval/validate-approval-request.ts";

export interface CreateApprovalRequestDependencies {
  idGenerator: AuditIdGenerator;
  clock: AuditClock;
}

export function createApprovalRequest(
  dependencies: CreateApprovalRequestDependencies,
  input: CreateApprovalRequestInput
): ApprovalRequest {
  validateApprovalRequestInput(input);

  const timestamp = input.createdAt ?? dependencies.clock.now();

  return {
    id: input.id ?? dependencies.idGenerator.generate(),
    version: initialApprovalRequestVersion,
    requestType: input.requestType.trim(),
    title: input.title.trim(),
    description: input.description?.trim() || null,
    status: "draft",
    target: {
      entityType: input.target.entityType.trim(),
      entityId: input.target.entityId.trim(),
      entityDisplayName:
        input.target.entityDisplayName?.trim() || null
    },
    scope: {
      ...emptyApprovalScope,
      ...input.scope
    },
    requestedBy: {
      ...input.createdBy,
      displayName: input.createdBy.displayName.trim()
    },
    requestedAt: null,
    decidedBy: null,
    decidedAt: null,
    decisionComment: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    history: []
  };
}
