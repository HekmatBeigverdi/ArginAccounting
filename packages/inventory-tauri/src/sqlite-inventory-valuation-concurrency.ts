import type { DatabaseExecutor, DatabaseSession } from "@argin/database";
import {
  InventoryValuationConcurrencyError,
  type InventoryValuationIdempotencyRecord,
  type InventoryValuationIdempotencyRepository,
  type InventoryValuationStreamVersionRepository,
  type InventoryValuationStreamVersionSnapshot,
  type InventoryValuationTransactionalContext,
  type InventoryValuationTransactionalUnitOfWork,
} from "@argin/inventory/valuation-concurrency";
import {
  SqliteInventoryCostLayerRepository,
  SqliteInventoryValuationCostInputProvider,
  SqliteInventoryValuationEntryRepository,
  SqliteInventoryValuationMovementReader,
  SqliteInventoryValuationPolicyRepository,
  SqliteInventoryValuationStateRepository,
} from "./sqlite-inventory-valuation-repositories.ts";

type IdempotencyRow = {
  company_id: string;
  request_id: string;
  operation: string;
  payload_fingerprint: string;
  outcome_kind: InventoryValuationIdempotencyRecord["outcomeKind"];
  outcome_id: string;
  outcome_revision: number | null;
  recorded_at: string;
};

type StreamVersionRow = {
  company_id: string;
  stream_key: string;
  revision: number;
};

const concurrencyConflict = (field: string): never => {
  throw new InventoryValuationConcurrencyError("VALUATION_CONCURRENCY_CONFLICT", field);
};

const idempotencyFromRow = (row: IdempotencyRow): InventoryValuationIdempotencyRecord => Object.freeze({
  companyId: row.company_id,
  requestId: row.request_id,
  operation: row.operation,
  payloadFingerprint: row.payload_fingerprint,
  outcomeKind: row.outcome_kind,
  outcomeId: row.outcome_id,
  outcomeRevision: row.outcome_revision,
  recordedAt: row.recorded_at,
});

const streamFromRow = (row: StreamVersionRow): InventoryValuationStreamVersionSnapshot => Object.freeze({
  companyId: row.company_id,
  streamKey: row.stream_key,
  revision: row.revision,
});

export class SqliteInventoryValuationIdempotencyRepository implements InventoryValuationIdempotencyRepository {
  constructor(private readonly db: DatabaseSession) {}

  async find(companyId: string, requestId: string): Promise<InventoryValuationIdempotencyRecord | null> {
    const row = await this.db.queryOne<IdempotencyRow>(
      `SELECT company_id,request_id,operation,payload_fingerprint,outcome_kind,outcome_id,outcome_revision,recorded_at
       FROM inventory_valuation_idempotency WHERE company_id=? AND request_id=?`,
      [companyId, requestId],
    );
    return row ? idempotencyFromRow(row) : null;
  }

  async add(record: InventoryValuationIdempotencyRecord): Promise<void> {
    await this.db.execute(
      `INSERT INTO inventory_valuation_idempotency
       (company_id,request_id,operation,payload_fingerprint,outcome_kind,outcome_id,outcome_revision,recorded_at)
       VALUES(?,?,?,?,?,?,?,?)`,
      [record.companyId, record.requestId, record.operation, record.payloadFingerprint, record.outcomeKind,
       record.outcomeId, record.outcomeRevision, record.recordedAt],
    );
  }
}

export class SqliteInventoryValuationStreamVersionRepository implements InventoryValuationStreamVersionRepository {
  constructor(private readonly db: DatabaseSession) {}

  async get(companyId: string, streamKey: string): Promise<InventoryValuationStreamVersionSnapshot | null> {
    const row = await this.db.queryOne<StreamVersionRow>(
      `SELECT company_id,stream_key,revision FROM inventory_valuation_stream_versions WHERE company_id=? AND stream_key=?`,
      [companyId, streamKey],
    );
    return row ? streamFromRow(row) : null;
  }

  async advance(companyId: string, streamKey: string, expectedRevision: number): Promise<InventoryValuationStreamVersionSnapshot> {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) concurrencyConflict("expectedRevision");
    if (expectedRevision === 0) {
      try {
        await this.db.execute(
          `INSERT INTO inventory_valuation_stream_versions(company_id,stream_key,revision) VALUES(?,?,1)`,
          [companyId, streamKey],
        );
      } catch {
        return concurrencyConflict("expectedRevision");
      }
      return Object.freeze({ companyId, streamKey, revision: 1 });
    }

    const result = await this.db.execute(
      `UPDATE inventory_valuation_stream_versions
       SET revision=revision+1
       WHERE company_id=? AND stream_key=? AND revision=?`,
      [companyId, streamKey, expectedRevision],
    );
    if (result.rowsAffected !== 1) return concurrencyConflict("expectedRevision");
    return Object.freeze({ companyId, streamKey, revision: expectedRevision + 1 });
  }
}

const contextFor = (db: DatabaseSession): InventoryValuationTransactionalContext => Object.freeze({
  entries: new SqliteInventoryValuationEntryRepository(db),
  policies: new SqliteInventoryValuationPolicyRepository(db),
  layers: new SqliteInventoryCostLayerRepository(db),
  states: new SqliteInventoryValuationStateRepository(db),
  movements: new SqliteInventoryValuationMovementReader(db),
  costInputs: new SqliteInventoryValuationCostInputProvider(db),
  idempotency: new SqliteInventoryValuationIdempotencyRepository(db),
  streamVersions: new SqliteInventoryValuationStreamVersionRepository(db),
});

/**
 * Uses the same pinned SQLite transaction implementation as Phase 20 Inventory UoW.
 * Production DatabaseExecutor.transaction() executes BEGIN IMMEDIATE and commits or rolls back
 * the whole valuation mutation, including idempotency and stream-version CAS writes.
 */
export class SqliteInventoryValuationUnitOfWork implements InventoryValuationTransactionalUnitOfWork {
  constructor(private readonly database: DatabaseExecutor) {}

  execute<T>(work: (context: InventoryValuationTransactionalContext) => Promise<T>): Promise<T> {
    return this.database.transaction(async (transaction) => work(contextFor(transaction)));
  }
}
