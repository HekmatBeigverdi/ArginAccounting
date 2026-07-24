import type {
  AuditClock
} from "../../contracts/audit-clock.ts";

import type {
  AuditIdGenerator
} from "../../contracts/audit-id-generator.ts";

import type {
  ApprovalHistoryEntry,
  CreateApprovalHistoryEntryInput
} from "../../domain/approval/approval-history-entry.ts";

export interface CreateApprovalHistoryEntryDependencies {
  idGenerator: AuditIdGenerator;
  clock: AuditClock;
}

export function createApprovalHistoryEntry(
  dependencies: CreateApprovalHistoryEntryDependencies,
  approvalRequestId: string,
  input: CreateApprovalHistoryEntryInput
): ApprovalHistoryEntry {
  const normalizedRequestId = approvalRequestId.trim();

  if (!normalizedRequestId) {
    throw new Error("Approval request id is required.");
  }

  return {
    id: input.id ?? dependencies.idGenerator.generate(),
    approvalRequestId: normalizedRequestId,
    action: input.action,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    actor: {
      ...input.actor,
      displayName: input.actor.displayName.trim()
    },
    comment: input.comment?.trim() || null,
    occurredAt: input.occurredAt ?? dependencies.clock.now()
  };
}
