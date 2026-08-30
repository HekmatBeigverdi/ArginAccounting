import {
  recordAuditEntry,
  type AuditAction,
  type AuditClock,
  type AuditIdGenerator,
  type AuditPermissionAuthorizer,
  type CreateAuditEntryInput
} from "@argin/audit";
import {
  DatabaseExecutorAdapter,
  SqliteAuditRepository,
  SqliteAuditUnitOfWork
} from "@argin/audit-tauri";
import type { DatabaseExecutor } from "@argin/database";
import type {
  PartyAuditAction,
  PartyAuditEvent,
  PartyAuditSink
} from "@argin/party";

const internalAuditAuthorizer: AuditPermissionAuthorizer = {
  hasPermission: async () => true
};

const browserAuditIdGenerator: AuditIdGenerator = {
  generate: () => crypto.randomUUID()
};

const systemAuditClock: AuditClock = {
  now: () => new Date().toISOString()
};

const auditActionByPartyAction: Readonly<Record<PartyAuditAction, AuditAction>> = Object.freeze({
  "party.create": "create",
  "party.update": "update",
  "party.change-status": "status-change",
  "party.add-role": "assign",
  "party.remove-role": "unassign",
  "party.import": "import",
  "party.export": "export"
});

export function toSharedAuditEntryInput(
  event: PartyAuditEvent
): CreateAuditEntryInput {
  return Object.freeze({
    occurredAt: event.occurredAt,
    action: auditActionByPartyAction[event.action],
    outcome: "success",
    source: "desktop",
    actor: Object.freeze({
      type: "user" as const,
      id: event.actorId,
      displayName: event.actorId
    }),
    scope: Object.freeze({
      companyId: event.companyId,
      branchId: null,
      fiscalYearId: null
    }),
    target: Object.freeze({
      entityType: "party",
      entityId: event.partyId,
      entityDisplayName: null
    }),
    correlationId: event.correlationId,
    metadata: Object.freeze({
      ...event.metadata,
      partyAction: event.action,
      requestId: event.requestId
    })
  });
}

/**
 * Bridges the Party security/audit boundary to the existing shared Audit store.
 * The adapter belongs to Desktop composition: @argin/party remains unaware of
 * SQLite and @argin/audit, while every successful Party mutation can be stored
 * in the canonical audit_entries infrastructure.
 */
export function createPersistentPartyAuditSink(
  database: DatabaseExecutor
): PartyAuditSink {
  const sqliteDatabase = new DatabaseExecutorAdapter(database);
  const unitOfWork = new SqliteAuditUnitOfWork(sqliteDatabase);
  const auditRepository = new SqliteAuditRepository(sqliteDatabase);

  return Object.freeze({
    async record(event: PartyAuditEvent): Promise<void> {
      await recordAuditEntry(
        {
          idGenerator: browserAuditIdGenerator,
          clock: systemAuditClock,
          authorizer: internalAuditAuthorizer,
          unitOfWork,
          auditRepository
        },
        toSharedAuditEntryInput(event)
      );
    }
  });
}
