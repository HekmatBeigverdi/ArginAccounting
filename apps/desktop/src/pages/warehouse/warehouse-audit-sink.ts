import {
  recordAuditEntry,
  type AuditAction,
  type AuditClock,
  type AuditIdGenerator,
  type AuditPermissionAuthorizer,
  type CreateAuditEntryInput,
} from "@argin/audit";
import {
  DatabaseExecutorAdapter,
  SqliteAuditRepository,
  SqliteAuditUnitOfWork,
} from "@argin/audit-tauri";
import type { DatabaseExecutor } from "@argin/database";
import type {
  WarehouseAuditAction,
  WarehouseAuditEvent,
  WarehouseAuditSink,
} from "@argin/warehouse";

const internalAuditAuthorizer: AuditPermissionAuthorizer = {
  hasPermission: async () => true,
};

const browserAuditIdGenerator: AuditIdGenerator = {
  generate: () => crypto.randomUUID(),
};

const systemAuditClock: AuditClock = {
  now: () => new Date().toISOString(),
};

const actionMap: Readonly<Record<WarehouseAuditAction, AuditAction>> = Object.freeze({
  "warehouse.create": "create",
  "warehouse.update": "update",
  "warehouse.change-status": "status-change",
  "warehouse.change-scope": "update",
  "warehouse.zone.create": "create",
  "warehouse.location.create": "create",
  "warehouse.import": "import",
  "warehouse.export": "export",
  "warehouse.initial-setup": "create",
});

export function toSharedWarehouseAuditEntryInput(
  event: WarehouseAuditEvent,
): CreateAuditEntryInput {
  const isChild = event.childEntityId !== null;
  return Object.freeze({
    occurredAt: event.occurredAt,
    action: actionMap[event.action],
    outcome: "success",
    source: "desktop",
    actor: Object.freeze({
      type: "user" as const,
      id: event.actorId,
      displayName: event.actorId,
    }),
    scope: Object.freeze({
      companyId: event.companyId,
      branchId: null,
      fiscalYearId: null,
    }),
    target: Object.freeze({
      entityType: isChild ? "warehouse-location-structure" : "warehouse",
      entityId: event.childEntityId ?? event.warehouseId,
      entityDisplayName: null,
    }),
    correlationId: event.correlationId,
    metadata: Object.freeze({
      ...event.metadata,
      warehouseAction: event.action,
      warehouseId: event.warehouseId,
      childEntityId: event.childEntityId,
      requestId: event.requestId,
    }),
  });
}

export function createPersistentWarehouseAuditSink(
  database: DatabaseExecutor,
): WarehouseAuditSink {
  const sqlite = new DatabaseExecutorAdapter(database);
  const unitOfWork = new SqliteAuditUnitOfWork(sqlite);
  const auditRepository = new SqliteAuditRepository(sqlite);

  return Object.freeze({
    async record(event: WarehouseAuditEvent): Promise<void> {
      await recordAuditEntry(
        {
          idGenerator: browserAuditIdGenerator,
          clock: systemAuditClock,
          authorizer: internalAuditAuthorizer,
          unitOfWork,
          auditRepository,
        },
        toSharedWarehouseAuditEntryInput(event),
      );
    },
  });
}
