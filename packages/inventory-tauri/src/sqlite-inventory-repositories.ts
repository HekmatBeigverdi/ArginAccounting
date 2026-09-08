import type { DatabaseSession } from "@argin/database";
import {
  InventoryApplicationError,
  createInventoryStockKey,
  rehydrateInventoryDocument,
  rehydrateInventoryStockMovement,
  serializeInventoryOpeningBalanceKey,
  serializeInventoryStockKey,
  type InventoryBalanceProjectionRepository,
  type InventoryBusinessOrderRepository,
  type InventoryDocumentRepository,
  type InventoryDocumentSnapshot,
  type InventoryDocumentType,
  type InventoryIdempotencyRecord,
  type InventoryIdempotencyRepository,
  type InventoryLifecycleTransitionSnapshot,
  type InventoryMovementRepository,
  type InventoryOpeningBalanceKey,
  type InventoryOpeningBalanceRepository,
  type InventoryStockBalanceSnapshot,
  type InventoryStockKey,
  type InventoryStockMovementSnapshot,
  type InventoryLineOperationSnapshot,
} from "@argin/inventory";

const appError = (code: ConstructorParameters<typeof InventoryApplicationError>[0], field?: string): never => {
  throw new InventoryApplicationError(code, field ?? null);
};

const errorText = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).toLowerCase();

const mapWriteError = (error: unknown): never => {
  if (error instanceof InventoryApplicationError) throw error;
  const text = errorText(error);
  if (text.includes("inventory_idempotency") || text.includes("request_key")) {
    return appError("inventory.application.idempotency-conflict", "requestKey");
  }
  if (text.includes("reversal") || text.includes("compensation")) {
    return appError("inventory.application.movement-duplicate", "reversalOfMovementId");
  }
  if (text.includes("opening")) return appError("inventory.application.opening-duplicate", "openingKey");
  if (text.includes("document") && text.includes("unique")) {
    return appError("inventory.application.document-number-duplicate", "documentNumber");
  }
  if (text.includes("movement") && text.includes("unique")) {
    return appError("inventory.application.movement-duplicate", "movementId");
  }
  throw error;
};

type DocumentRow = {
  id: string; company_id: string; document_type: InventoryDocumentType; status: InventoryDocumentSnapshot["status"];
  document_number: string | null; business_date: string; description: string | null;
  origin_branch_id: string | null; destination_branch_id: string | null; fiscal_year_id: string; fiscal_period_id: string;
  source_system: string | null; source_document_type: string | null; source_document_id: string | null; source_line_id: string | null;
  version: number; created_at: string; updated_at: string; deleted_at: string | null;
};

type LineRow = {
  id: string; company_id: string; document_id: string; position: number; product_id: string; description: string | null;
  source_system: string | null; source_document_type: string | null; source_document_id: string | null; source_line_id: string | null;
  quantity_snapshot: string | null;
};

type LifecycleRow = {
  from_status: InventoryDocumentSnapshot["status"]; to_status: InventoryDocumentSnapshot["status"];
  occurred_at: string; actor_user_id: string; reason: string | null; related_document_id: string | null;
};

type MovementRow = {
  movement_id: string; company_id: string; document_id: string; line_id: string;
  transfer_id: string | null; reversal_of_movement_id: string | null; product_id: string;
  warehouse_id: string; zone_id: string | null; location_id: string | null;
  business_date: string; business_order: number; recorded_at: string; quantity_delta: string;
};

type IdempotencyRow = {
  company_id: string; request_key: string; operation: string; payload_fingerprint: string;
  outcome_kind: InventoryIdempotencyRecord["outcomeKind"]; document_id: string;
  document_version: number | null; document_status: InventoryIdempotencyRecord["documentStatus"]; recorded_at: string;
};

const sourceReference = (row: {
  company_id: string; source_system: string | null; source_document_type: string | null;
  source_document_id: string | null; source_line_id: string | null;
}) => row.source_system === null ? null : {
  companyId: row.company_id,
  sourceSystem: row.source_system,
  documentType: row.source_document_type ?? "",
  documentId: row.source_document_id ?? "",
  lineId: row.source_line_id,
};

const parseOperation = (value: string | null): InventoryLineOperationSnapshot | null => {
  if (value === null) return null;
  return JSON.parse(value) as InventoryLineOperationSnapshot;
};

const hydrateDocument = async (db: DatabaseSession, row: DocumentRow): Promise<InventoryDocumentSnapshot> => {
  const lines = await db.query<LineRow>(
    `SELECT id,company_id,document_id,position,product_id,description,
            source_system,source_document_type,source_document_id,source_line_id,quantity_snapshot
     FROM inventory_document_lines WHERE company_id=? AND document_id=? ORDER BY position,id`,
    [row.company_id, row.id],
  );
  const historyRows = await db.query<LifecycleRow>(
    `SELECT from_status,to_status,occurred_at,actor_user_id,reason,related_document_id
     FROM inventory_document_lifecycle WHERE company_id=? AND document_id=? ORDER BY sequence`,
    [row.company_id, row.id],
  );
  const lifecycleHistory: readonly InventoryLifecycleTransitionSnapshot[] = Object.freeze(historyRows.map((item) => Object.freeze({
    fromStatus: item.from_status,
    toStatus: item.to_status,
    occurredAt: item.occurred_at,
    actorUserId: item.actor_user_id,
    reason: item.reason,
    relatedDocumentId: item.related_document_id,
  })));
  return rehydrateInventoryDocument({
    documentId: row.id,
    companyId: row.company_id,
    documentType: row.document_type,
    status: row.status,
    documentNumber: row.document_number,
    businessDate: row.business_date,
    description: row.description,
    sourceReference: sourceReference(row),
    scope: {
      branchId: row.origin_branch_id,
      destinationBranchId: row.destination_branch_id,
      fiscalYearId: row.fiscal_year_id,
      fiscalPeriodId: row.fiscal_period_id,
    },
    lines: Object.freeze(lines.map((line) => Object.freeze({
      lineId: line.id,
      position: line.position,
      productId: line.product_id,
      description: line.description,
      sourceReference: sourceReference(line),
      operation: parseOperation(line.quantity_snapshot),
    }))),
    lifecycleHistory,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
};

const writeLine = async (db: DatabaseSession, document: InventoryDocumentSnapshot, line: InventoryDocumentSnapshot["lines"][number]): Promise<void> => {
  const operation = line.operation;
  const quantity = operation?.quantity ?? null;
  const source = line.sourceReference;
  await db.execute(
    `INSERT INTO inventory_document_lines
     (id,company_id,document_id,position,product_id,description,
      source_system,source_document_type,source_document_id,source_line_id,
      entered_quantity,base_quantity,entered_unit_id,base_unit_id,quantity_snapshot,
      warehouse_id,zone_id,location_id,destination_warehouse_id,destination_zone_id,destination_location_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      line.lineId, document.companyId, document.documentId, line.position, line.productId, line.description,
      source?.sourceSystem ?? null, source?.documentType ?? null, source?.documentId ?? null, source?.lineId ?? null,
      quantity?.enteredQuantity ?? null, quantity?.baseQuantity ?? null,
      quantity?.enteredUnit.unitId ?? null, quantity?.baseUnit.unitId ?? null,
      operation === null ? null : JSON.stringify(operation),
      operation?.warehouse.warehouseId ?? null, operation?.warehouse.zoneId ?? null, operation?.warehouse.locationId ?? null,
      operation?.destination?.warehouseId ?? null, operation?.destination?.zoneId ?? null, operation?.destination?.locationId ?? null,
    ],
  );
};

const appendMissingLifecycle = async (db: DatabaseSession, document: InventoryDocumentSnapshot): Promise<void> => {
  const countRow = await db.queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM inventory_document_lifecycle WHERE company_id=? AND document_id=?",
    [document.companyId, document.documentId],
  );
  const persisted = Number(countRow?.count ?? 0);
  for (let index = persisted; index < document.lifecycleHistory.length; index += 1) {
    const item = document.lifecycleHistory[index];
    if (!item) continue;
    await db.execute(
      `INSERT INTO inventory_document_lifecycle
       (document_id,company_id,sequence,from_status,to_status,occurred_at,actor_user_id,reason,related_document_id)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [document.documentId, document.companyId, index + 1, item.fromStatus, item.toStatus,
        item.occurredAt, item.actorUserId, item.reason, item.relatedDocumentId],
    );
  }
};

export class SqliteInventoryDocumentRepository implements InventoryDocumentRepository {
  constructor(private readonly db: DatabaseSession) {}

  async findById(companyId: string, documentId: string): Promise<InventoryDocumentSnapshot | null> {
    const row = await this.db.queryOne<DocumentRow>(
      "SELECT * FROM inventory_documents WHERE company_id=? AND id=? AND deleted_at IS NULL",
      [companyId, documentId],
    );
    return row ? hydrateDocument(this.db, row) : null;
  }

  async findByNumber(companyId: string, fiscalYearId: string, branchId: string | null, documentType: InventoryDocumentType, documentNumber: string): Promise<InventoryDocumentSnapshot | null> {
    const row = await this.db.queryOne<DocumentRow>(
      `SELECT * FROM inventory_documents
       WHERE company_id=? AND fiscal_year_id=? AND COALESCE(origin_branch_id,'')=COALESCE(?, '')
         AND document_type=? AND document_number=? AND deleted_at IS NULL`,
      [companyId, fiscalYearId, branchId, documentType, documentNumber],
    );
    return row ? hydrateDocument(this.db, row) : null;
  }

  async add(document: InventoryDocumentSnapshot): Promise<void> {
    const scope = document.scope;
    if (!scope) return appError("inventory.application.invalid-request", "scope");
    const source = document.sourceReference;
    try {
      await this.db.execute(
        `INSERT INTO inventory_documents
         (id,company_id,document_type,status,document_number,business_date,description,
          origin_branch_id,destination_branch_id,fiscal_year_id,fiscal_period_id,
          source_system,source_document_type,source_document_id,source_line_id,
          version,created_at,updated_at,sync_origin,sync_changed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [document.documentId, document.companyId, document.documentType, document.status, document.documentNumber,
          document.businessDate, document.description, scope.branchId, scope.destinationBranchId,
          scope.fiscalYearId, scope.fiscalPeriodId, source?.sourceSystem ?? null, source?.documentType ?? null,
          source?.documentId ?? null, source?.lineId ?? null, document.version, document.createdAt, document.updatedAt,
          "local", document.updatedAt],
      );
      for (const line of document.lines) await writeLine(this.db, document, line);
      await appendMissingLifecycle(this.db, document);
    } catch (error) { mapWriteError(error); }
  }

  async update(document: InventoryDocumentSnapshot, expectedVersion: number): Promise<void> {
    const scope = document.scope;
    if (!scope) return appError("inventory.application.invalid-request", "scope");
    const source = document.sourceReference;
    try {
      const result = await this.db.execute(
        `UPDATE inventory_documents SET
           document_type=?,status=?,document_number=?,business_date=?,description=?,
           origin_branch_id=?,destination_branch_id=?,fiscal_year_id=?,fiscal_period_id=?,
           source_system=?,source_document_type=?,source_document_id=?,source_line_id=?,
           version=?,updated_at=?,sync_changed_at=?
         WHERE company_id=? AND id=? AND version=? AND deleted_at IS NULL`,
        [document.documentType, document.status, document.documentNumber, document.businessDate, document.description,
          scope.branchId, scope.destinationBranchId, scope.fiscalYearId, scope.fiscalPeriodId,
          source?.sourceSystem ?? null, source?.documentType ?? null, source?.documentId ?? null, source?.lineId ?? null,
          document.version, document.updatedAt, document.updatedAt,
          document.companyId, document.documentId, expectedVersion],
      );
      if (result.rowsAffected !== 1) {
        const exists = await this.db.queryOne<{ version: number }>(
          "SELECT version FROM inventory_documents WHERE company_id=? AND id=? AND deleted_at IS NULL",
          [document.companyId, document.documentId],
        );
        return appError(exists ? "inventory.application.concurrency-conflict" : "inventory.application.not-found", "expectedVersion");
      }

      // Lines are mutable only before stock confirmation. Confirm/reverse paths keep the accepted line facts untouched.
      if (document.status === "draft" || document.status === "submitted" || document.status === "approved" || document.status === "cancelled") {
        const movement = await this.db.queryOne<{ movement_id: string }>(
          "SELECT movement_id FROM inventory_all_stock_movements WHERE company_id=? AND document_id=? LIMIT 1",
          [document.companyId, document.documentId],
        );
        if (!movement) {
          await this.db.execute("DELETE FROM inventory_document_lines WHERE company_id=? AND document_id=?", [document.companyId, document.documentId]);
          for (const line of document.lines) await writeLine(this.db, document, line);
        }
      }
      await appendMissingLifecycle(this.db, document);
    } catch (error) { mapWriteError(error); }
  }

  async markDraftDeleted(companyId: string, documentId: string, expectedVersion: number, deletedAt: string): Promise<void> {
    const result = await this.db.execute(
      `UPDATE inventory_documents SET deleted_at=?,updated_at=?,sync_changed_at=?,version=version+1
       WHERE company_id=? AND id=? AND version=? AND status='draft' AND deleted_at IS NULL`,
      [deletedAt, deletedAt, deletedAt, companyId, documentId, expectedVersion],
    );
    if (result.rowsAffected !== 1) {
      const exists = await this.db.queryOne<{ id: string; version: number }>(
        "SELECT id,version FROM inventory_documents WHERE company_id=? AND id=? AND deleted_at IS NULL",
        [companyId, documentId],
      );
      return appError(exists ? "inventory.application.concurrency-conflict" : "inventory.application.not-found", "expectedVersion");
    }
  }
}

const mapMovement = (row: MovementRow): InventoryStockMovementSnapshot => rehydrateInventoryStockMovement({
  movementId: row.movement_id,
  companyId: row.company_id,
  documentId: row.document_id,
  lineId: row.line_id,
  transferId: row.transfer_id,
  reversalOfMovementId: row.reversal_of_movement_id,
  stockKey: createInventoryStockKey({
    companyId: row.company_id,
    productId: row.product_id,
    warehouse: { warehouseId: row.warehouse_id, zoneId: row.zone_id, locationId: row.location_id },
  }),
  businessDate: row.business_date,
  businessOrder: row.business_order,
  recordedAt: row.recorded_at,
  quantityDelta: row.quantity_delta,
});

const movementSelect = `SELECT movement_id,company_id,document_id,line_id,transfer_id,reversal_of_movement_id,
 product_id,warehouse_id,zone_id,location_id,business_date,business_order,recorded_at,quantity_delta
 FROM inventory_all_stock_movements`;

export class SqliteInventoryMovementRepository implements InventoryMovementRepository {
  constructor(private readonly db: DatabaseSession) {}

  async findById(companyId: string, movementId: string): Promise<InventoryStockMovementSnapshot | null> {
    const row = await this.db.queryOne<MovementRow>(`${movementSelect} WHERE company_id=? AND movement_id=?`, [companyId, movementId]);
    return row ? mapMovement(row) : null;
  }

  async listByDocument(companyId: string, documentId: string): Promise<readonly InventoryStockMovementSnapshot[]> {
    const rows = await this.db.query<MovementRow>(
      `${movementSelect} WHERE company_id=? AND document_id=? ORDER BY business_date,business_order,line_id,movement_id`,
      [companyId, documentId],
    );
    return Object.freeze(rows.map(mapMovement));
  }

  async listByStockKey(stockKey: InventoryStockKey): Promise<readonly InventoryStockMovementSnapshot[]> {
    const key = createInventoryStockKey({
      companyId: stockKey.companyId,
      productId: stockKey.productId,
      warehouse: { warehouseId: stockKey.warehouseId, zoneId: stockKey.zoneId, locationId: stockKey.locationId },
    });
    const rows = await this.db.query<MovementRow>(
      `${movementSelect}
       WHERE company_id=? AND product_id=? AND warehouse_id=?
         AND COALESCE(zone_id,'')=COALESCE(?, '') AND COALESCE(location_id,'')=COALESCE(?, '')
       ORDER BY business_date,business_order,document_id,line_id,movement_id`,
      [key.companyId, key.productId, key.warehouseId, key.zoneId, key.locationId],
    );
    return Object.freeze(rows.map(mapMovement));
  }

  async appendBatch(movements: readonly InventoryStockMovementSnapshot[]): Promise<void> {
    try {
      for (const movement of movements) {
        const fact = rehydrateInventoryStockMovement(movement);
        if (fact.reversalOfMovementId !== null) {
          await this.db.execute(
            `INSERT INTO inventory_stock_movement_compensations
             (movement_id,company_id,effect_document_id,source_line_id,original_movement_id,
              product_id,warehouse_id,zone_id,location_id,business_date,business_order,recorded_at,quantity_delta)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [fact.movementId, fact.companyId, fact.documentId, fact.lineId, fact.reversalOfMovementId,
              fact.stockKey.productId, fact.stockKey.warehouseId, fact.stockKey.zoneId, fact.stockKey.locationId,
              fact.businessDate, fact.businessOrder, fact.recordedAt, fact.quantityDelta],
          );
        } else {
          await this.db.execute(
            `INSERT INTO inventory_stock_movements
             (movement_id,company_id,document_id,line_id,transfer_id,reversal_of_movement_id,
              product_id,warehouse_id,zone_id,location_id,business_date,business_order,recorded_at,quantity_delta)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [fact.movementId, fact.companyId, fact.documentId, fact.lineId, fact.transferId, null,
              fact.stockKey.productId, fact.stockKey.warehouseId, fact.stockKey.zoneId, fact.stockKey.locationId,
              fact.businessDate, fact.businessOrder, fact.recordedAt, fact.quantityDelta],
          );
        }
      }
    } catch (error) { mapWriteError(error); }
  }
}

export class SqliteInventoryBalanceProjectionRepository implements InventoryBalanceProjectionRepository {
  constructor(private readonly db: DatabaseSession) {}

  async find(stockKey: InventoryStockKey): Promise<InventoryStockBalanceSnapshot | null> {
    const serialized = serializeInventoryStockKey(stockKey);
    const row = await this.db.queryOne<{ quantity: string }>(
      "SELECT quantity FROM inventory_stock_balances WHERE stock_key=? AND company_id=?",
      [serialized, stockKey.companyId],
    );
    if (!row) return null;
    const history = await new SqliteInventoryMovementRepository(this.db).listByStockKey(stockKey);
    return Object.freeze({
      stockKey: createInventoryStockKey({
        companyId: stockKey.companyId, productId: stockKey.productId,
        warehouse: { warehouseId: stockKey.warehouseId, zoneId: stockKey.zoneId, locationId: stockKey.locationId },
      }),
      quantity: row.quantity,
      movementCount: history.length,
      lastMovementId: history.at(-1)?.movementId ?? null,
    });
  }

  async replaceBatch(balances: readonly InventoryStockBalanceSnapshot[]): Promise<void> {
    for (const balance of balances) {
      const key = balance.stockKey;
      const serialized = serializeInventoryStockKey(key);
      await this.db.execute(
        `INSERT INTO inventory_stock_balances
         (stock_key,company_id,product_id,warehouse_id,zone_id,location_id,quantity,
          last_business_date,last_business_order,last_movement_id,rebuilt_at)
         VALUES (?,?,?,?,?,?,?,NULL,NULL,NULL,?)
         ON CONFLICT(stock_key) DO UPDATE SET quantity=excluded.quantity,rebuilt_at=excluded.rebuilt_at,
           last_business_date=NULL,last_business_order=NULL,last_movement_id=NULL`,
        [serialized, key.companyId, key.productId, key.warehouseId, key.zoneId, key.locationId,
          balance.quantity, new Date().toISOString()],
      );
    }
  }
}

export class SqliteInventoryOpeningBalanceRepository implements InventoryOpeningBalanceRepository {
  constructor(private readonly db: DatabaseSession) {}

  async exists(key: InventoryOpeningBalanceKey): Promise<boolean> {
    const row = await this.db.queryOne<{ opening_key: string }>(
      "SELECT opening_key FROM inventory_opening_balances WHERE opening_key=?",
      [serializeInventoryOpeningBalanceKey(key)],
    );
    return row !== null;
  }

  async addBatch(keys: readonly InventoryOpeningBalanceKey[]): Promise<void> {
    try {
      for (const key of keys) {
        const stock = key.stockKey;
        const movement = await this.db.queryOne<MovementRow>(
          `${movementSelect}
           JOIN inventory_documents d ON d.company_id=inventory_all_stock_movements.company_id
             AND d.id=inventory_all_stock_movements.document_id
           WHERE inventory_all_stock_movements.company_id=? AND d.document_type='opening'
             AND d.fiscal_year_id=? AND product_id=? AND warehouse_id=?
             AND COALESCE(zone_id,'')=COALESCE(?, '') AND COALESCE(location_id,'')=COALESCE(?, '')
           ORDER BY recorded_at DESC,movement_id DESC LIMIT 1`,
          [key.companyId, key.fiscalYearId, stock.productId, stock.warehouseId, stock.zoneId, stock.locationId],
        );
        if (!movement) return appError("inventory.application.invalid-request", "openingKey");
        await this.db.execute(
          `INSERT INTO inventory_opening_balances
           (opening_key,company_id,fiscal_year_id,document_id,line_id,product_id,warehouse_id,zone_id,location_id,created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [serializeInventoryOpeningBalanceKey(key), key.companyId, key.fiscalYearId,
            movement.document_id, movement.line_id, stock.productId, stock.warehouseId,
            stock.zoneId, stock.locationId, movement.recorded_at],
        );
      }
    } catch (error) { mapWriteError(error); }
  }
}

export class SqliteInventoryBusinessOrderRepository implements InventoryBusinessOrderRepository {
  constructor(private readonly db: DatabaseSession) {}

  async next(companyId: string, businessDate: string): Promise<number> {
    const row = await this.db.queryOne<{ last_order: number }>(
      `INSERT INTO inventory_business_orders(company_id,business_date,last_order) VALUES (?,?,1)
       ON CONFLICT(company_id,business_date) DO UPDATE SET last_order=inventory_business_orders.last_order+1
       RETURNING last_order`,
      [companyId, businessDate],
    );
    if (!row || !Number.isSafeInteger(row.last_order) || row.last_order < 1) {
      return appError("inventory.application.concurrency-conflict", "businessOrder");
    }
    return row.last_order;
  }
}

export class SqliteInventoryIdempotencyRepository implements InventoryIdempotencyRepository {
  constructor(private readonly db: DatabaseSession) {}

  async find(companyId: string, requestKey: string): Promise<InventoryIdempotencyRecord | null> {
    const row = await this.db.queryOne<IdempotencyRow>(
      "SELECT * FROM inventory_idempotency WHERE company_id=? AND request_key=?",
      [companyId, requestKey],
    );
    return row ? Object.freeze({
      companyId: row.company_id,
      requestKey: row.request_key,
      operation: row.operation,
      payloadFingerprint: row.payload_fingerprint,
      outcomeKind: row.outcome_kind,
      documentId: row.document_id,
      documentVersion: row.document_version,
      documentStatus: row.document_status,
      recordedAt: row.recorded_at,
    }) : null;
  }

  async add(record: InventoryIdempotencyRecord): Promise<void> {
    try {
      await this.db.execute(
        `INSERT INTO inventory_idempotency
         (company_id,request_key,operation,payload_fingerprint,outcome_kind,document_id,document_version,document_status,recorded_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [record.companyId, record.requestKey, record.operation, record.payloadFingerprint, record.outcomeKind,
          record.documentId, record.documentVersion, record.documentStatus, record.recordedAt],
      );
    } catch (error) { mapWriteError(error); }
  }
}
