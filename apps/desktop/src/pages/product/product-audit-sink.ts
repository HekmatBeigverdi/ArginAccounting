import {
  recordAuditEntry,
  type AuditAction,
  type AuditClock,
  type AuditIdGenerator,
  type AuditPermissionAuthorizer,
  type AuditRepositories,
  type AuditUnitOfWork,
  type CreateAuditEntryInput,
} from "@argin/audit";
import {
  SqliteApprovalRepository,
  SqliteAuditRepository,
  type SqliteDatabase,
} from "@argin/audit-tauri";
import type {
  DatabaseExecutor,
  DatabaseSession,
} from "@argin/database";
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

function toAuditDatabase(session: DatabaseSession): SqliteDatabase {
  return Object.freeze({
    async execute(sql: string, parameters?: unknown[]) {
      const result = await session.execute(sql, parameters as any);
      return {
        rowsAffected: result.rowsAffected,
        ...(result.lastInsertId === undefined
          ? {}
          : { lastInsertId: result.lastInsertId }),
      };
    },
    async select<T>(sql: string, parameters?: unknown[]): Promise<T> {
      return await session.query(sql, parameters as any) as T;
    },
  });
}

function createSharedAuditUnitOfWork(database: DatabaseExecutor): AuditUnitOfWork {
  return Object.freeze({
    async run<T>(action: (repositories: AuditRepositories) => Promise<T>): Promise<T> {
      return database.transaction(async (transaction) => {
        const sqlite = toAuditDatabase(transaction);
        return action({
          audit: new SqliteAuditRepository(sqlite),
          approval: new SqliteApprovalRepository(sqlite),
        });
      });
    },
  });
}

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
  const unitOfWork = createSharedAuditUnitOfWork(database);

  return Object.freeze({
    async record(event: ProductAuditEvent): Promise<void> {
      await recordAuditEntry(
        {
          idGenerator: browserAuditIdGenerator,
          clock: systemAuditClock,
          authorizer: internalAuditAuthorizer,
          unitOfWork,
          auditRepository: new SqliteAuditRepository(toAuditDatabase(database)),
        },
        toSharedProductAuditEntryInput(event),
      );
    },
  });
}
