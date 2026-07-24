import type {
  AuditClock
} from "../../contracts/audit-clock";

import type {
  AuditIdGenerator
} from "../../contracts/audit-id-generator";

import type {
  AuditEntry,
  CreateAuditEntryInput
} from "../../domain/audit-entry";

import {
  emptyAuditScope
} from "../../domain/audit-scope";

import {
  sanitizeAuditSnapshot
} from "../../domain/sanitize-audit-snapshot";

import {
  validateAuditEntryInput
} from "../../validation/validate-audit-entry";

export interface CreateAuditEntryDependencies {
  idGenerator: AuditIdGenerator;
  clock: AuditClock;
}

export function createAuditEntry(
  dependencies: CreateAuditEntryDependencies,
  input: CreateAuditEntryInput
): AuditEntry {
  validateAuditEntryInput(input);

  return {
    id: input.id ?? dependencies.idGenerator.generate(),
    occurredAt: input.occurredAt ?? dependencies.clock.now(),
    action: input.action,
    outcome: input.outcome ?? "success",
    source: input.source,
    actor: {
      ...input.actor,
      displayName: input.actor.displayName.trim()
    },
    scope: {
      ...emptyAuditScope,
      ...input.scope
    },
    target: {
      entityType: input.target.entityType.trim(),
      entityId: input.target.entityId?.trim() || null,
      entityDisplayName:
        input.target.entityDisplayName?.trim() || null
    },
    message: input.message?.trim() || null,
    reason: input.reason?.trim() || null,
    before:
      input.before === undefined || input.before === null
        ? null
        : sanitizeAuditSnapshot(input.before),
    after:
      input.after === undefined || input.after === null
        ? null
        : sanitizeAuditSnapshot(input.after),
    correlationId: input.correlationId?.trim() || null,
    metadata: input.metadata ?? null
  };
}
