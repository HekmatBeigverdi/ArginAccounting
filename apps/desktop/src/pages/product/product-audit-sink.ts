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
  ProductAuditAction,
  ProductAuditEvent,
  ProductAuditSink,
} from "@argin/product";

const internalAuditAuthorizer: AuditPermissionAuthorizer = {
  hasPermission: async () => true,
};

const browserAuditIdGenerator: AuditIdGenerator = {
  generate: () => crypto.randomUUID(),
};

const systemAuditClock: AuditClock = {
  now: () => new Date().toISOString(),
};

const actionMap: Readonly<Record<ProductAuditAction, AuditAction>> = Object.freeze({
  "product.create": "create",
  "product.update-identity": "update",
  "product.replace-identifiers": "update",
  "product.replace-units": "update",
  "product.replace-master-data": "update",
  "product.change-status": "status-change",
  "product.import": "import",
  "product.export": "export",
  "product.taxpayer-reference-data.update": "update",
});

export function toSharedProductAuditEntryInput(event: ProductAuditEvent): CreateAuditEntryInput {
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
      entityType: "product",
      entityId: event.productId,
      entityDisplayName: null,
    }),
    correlationId: event.correlationId,
    metadata: Object.freeze({
      ...event.metadata,
      productAction: event.action,
      requestId: event.requestId,
    }),
  });
}

export function createPersistentProductAuditSink(database: DatabaseExecutor): ProductAuditSink {
  const sqliteDatabase = new DatabaseExecutorAdapter(database);
  const unitOfWork = new SqliteAuditUnitOfWork(sqliteDatabase);
  const auditRepository = new SqliteAuditRepository(sqliteDatabase);

  return Object.freeze({
    async record(event: ProductAuditEvent): Promise<void> {
      await recordAuditEntry(
        {
          idGenerator: browserAuditIdGenerator,
          clock: systemAuditClock,
          authorizer: internalAuditAuthorizer,
          unitOfWork,
          auditRepository,
        },
        toSharedProductAuditEntryInput(event),
      );
    },
  });
}
