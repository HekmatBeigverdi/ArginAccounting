import type { DatabaseSession } from "@argin/database";
import {
  SalesDomainError,
  createSalesDocument,
  createSalesLifecycle,
  transitionSalesLifecycle,
  type CreateSalesCommercialTermsInput,
  type SalesCommercialTerms,
  type SalesDocumentRepository,
  type SalesDocumentSnapshot,
  type SalesDomainErrorCode,
  type SalesIdempotencyReader,
  type SalesIdempotencyRecord,
  type SalesIdempotencyWriter,
  type SalesLifecycleAction,
  type SalesLifecycleState,
  type SalesPersistedDocument,
} from "@argin/sales";

type DocumentRow = {
  id: string;
  company_id: string;
  document_json: string;
  version: number;
  created_at: string;
  updated_at: string;
};

type TransitionRow = {
  transition_id: string;
  action: SalesLifecycleAction;
  actor_id: string;
  occurred_at: string;
  reason: string | null;
};

type IdempotencyRow = {
  company_id: string;
  request_id: string;
  operation_id: string;
  operation: string;
  payload_fingerprint: string;
  outcome_kind: SalesIdempotencyRecord["outcomeKind"];
  outcome_id: string;
  outcome_version: number | null;
  outcome_status: string | null;
  result_json: string;
  recorded_at: string;
};

function fail(code: SalesDomainErrorCode, field: string): never {
  throw new SalesDomainError(code, field);
}

function parseJson<T>(value: string, field: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fail("sales.input_invalid", field);
  }
}

function toCommercialTermsInput(
  terms: SalesCommercialTerms | null,
): CreateSalesCommercialTermsInput | null {
  if (terms == null) return null;

  // Stored adjustments use specific identity fields; constructors accept `id`.
  return {
    ...terms,
    discounts: terms.discounts.map(({ discountId, ...adjustment }) => ({
      id: discountId,
      ...adjustment,
    })),
    charges: terms.charges.map(({ chargeId, ...adjustment }) => ({
      id: chargeId,
      ...adjustment,
    })),
  };
}

function rehydrateDocument(snapshot: SalesDocumentSnapshot): SalesDocumentSnapshot {
  return createSalesDocument({
    documentId: snapshot.documentId,
    documentType: snapshot.documentType,
    companyId: snapshot.scope.companyId,
    branchId: snapshot.scope.branchId,
    fiscalYearId: snapshot.scope.fiscalYearId,
    customer: snapshot.customer,
    documentNumber: snapshot.documentNumber,
    businessDate: snapshot.businessDate,
    description: snapshot.description,
    sourceReference: snapshot.sourceReference,
    relatedDocumentReference: snapshot.relatedDocumentReference,
    lines: snapshot.lines.map((line) => ({
      lineId: line.lineId,
      position: line.position,
      lineKind: line.lineKind,
      productId: line.item.productId,
      itemType: line.item.itemType,
      description: line.description,
      sourceReference: line.sourceReference,
      commercialTerms: toCommercialTermsInput(line.commercialTerms),
    })),
  });
}

async function hydrateLifecycle(
  db: DatabaseSession,
  document: SalesDocumentSnapshot,
): Promise<SalesLifecycleState> {
  let lifecycle = createSalesLifecycle(document.documentId, document.documentType);
  const rows = await db.query<TransitionRow>(
    `SELECT transition_id,action,actor_id,occurred_at,reason
     FROM sales_document_lifecycle
     WHERE company_id=? AND document_id=?
     ORDER BY sequence`,
    [document.scope.companyId, document.documentId],
  );

  for (const row of rows) {
    lifecycle = transitionSalesLifecycle(lifecycle, {
      transitionId: row.transition_id,
      action: row.action,
      actorId: row.actor_id,
      occurredAt: row.occurred_at,
      reason: row.reason,
    });
  }
  return lifecycle;
}

async function appendLifecycle(db: DatabaseSession, state: SalesPersistedDocument): Promise<void> {
  const { document, lifecycle } = state;
  const row = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) AS count FROM sales_document_lifecycle
     WHERE company_id=? AND document_id=?`,
    [document.scope.companyId, document.documentId],
  );
  const persistedCount = Number(row?.count ?? 0);

  for (let index = persistedCount; index < lifecycle.transitions.length; index += 1) {
    const transition = lifecycle.transitions[index];
    if (!transition) continue;

    await db.execute(
      `INSERT INTO sales_document_lifecycle
       (company_id,document_id,sequence,transition_id,from_status,to_status,action,actor_id,occurred_at,reason)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        document.scope.companyId,
        document.documentId,
        index + 1,
        transition.transitionId,
        transition.fromStatus,
        transition.toStatus,
        transition.action,
        transition.actorId,
        transition.occurredAt,
        transition.reason,
      ],
    );
  }
}

export class SqliteSalesDocumentRepository implements SalesDocumentRepository {
  constructor(private readonly db: DatabaseSession) {}

  async findById(companyId: string, documentId: string): Promise<SalesPersistedDocument | null> {
    const row = await this.db.queryOne<DocumentRow>(
      `SELECT id,company_id,document_json,version,created_at,updated_at
       FROM sales_documents WHERE company_id=? AND id=?`,
      [companyId, documentId],
    );
    if (!row) return null;

    const snapshot = parseJson<SalesDocumentSnapshot>(row.document_json, "sales.document_json");
    const document = rehydrateDocument(snapshot);
    return Object.freeze({
      document,
      lifecycle: await hydrateLifecycle(this.db, document),
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  async add(state: SalesPersistedDocument): Promise<void> {
    if (state.version !== 1) return fail("sales.version_invalid", "version");

    const { document, lifecycle } = state;
    await this.db.execute(
      `INSERT INTO sales_documents
       (id,company_id,branch_id,fiscal_year_id,document_type,customer_id,document_number,
        business_date,status,document_json,version,created_at,updated_at,sync_origin,sync_changed_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        document.documentId,
        document.scope.companyId,
        document.scope.branchId,
        document.scope.fiscalYearId,
        document.documentType,
        document.customer.partyId,
        document.documentNumber,
        document.businessDate,
        lifecycle.status,
        JSON.stringify(document),
        state.version,
        state.createdAt,
        state.updatedAt,
        "local",
        state.updatedAt,
      ],
    );
    await appendLifecycle(this.db, state);
  }

  async update(state: SalesPersistedDocument, expectedVersion: number): Promise<void> {
    if (state.version !== expectedVersion + 1) return fail("sales.version_invalid", "version");

    const { document, lifecycle } = state;
    const result = await this.db.execute(
      `UPDATE sales_documents SET
        branch_id=?,fiscal_year_id=?,customer_id=?,document_number=?,business_date=?,
        status=?,document_json=?,version=?,updated_at=?,sync_changed_at=?
       WHERE company_id=? AND id=? AND version=?`,
      [
        document.scope.branchId,
        document.scope.fiscalYearId,
        document.customer.partyId,
        document.documentNumber,
        document.businessDate,
        lifecycle.status,
        JSON.stringify(document),
        state.version,
        state.updatedAt,
        state.updatedAt,
        document.scope.companyId,
        document.documentId,
        expectedVersion,
      ],
    );
    if (result.rowsAffected !== 1) return fail("sales.concurrency_conflict", "expectedVersion");

    await appendLifecycle(this.db, state);
  }
}

function mapIdempotency(row: IdempotencyRow): SalesIdempotencyRecord {
  return Object.freeze({
    companyId: row.company_id,
    requestId: row.request_id,
    operationId: row.operation_id,
    operation: row.operation,
    payloadFingerprint: row.payload_fingerprint,
    outcomeKind: row.outcome_kind,
    outcomeId: row.outcome_id,
    outcomeVersion: row.outcome_version,
    outcomeStatus: row.outcome_status,
    resultJson: row.result_json,
    recordedAt: row.recorded_at,
  });
}

export class SqliteSalesIdempotencyRepository implements SalesIdempotencyReader, SalesIdempotencyWriter {
  constructor(private readonly db: DatabaseSession) {}

  async findByRequestId(companyId: string, requestId: string): Promise<SalesIdempotencyRecord | null> {
    const row = await this.db.queryOne<IdempotencyRow>(
      "SELECT * FROM sales_idempotency WHERE company_id=? AND request_id=?",
      [companyId, requestId],
    );
    return row ? mapIdempotency(row) : null;
  }

  async findByOperationId(companyId: string, operationId: string): Promise<SalesIdempotencyRecord | null> {
    const row = await this.db.queryOne<IdempotencyRow>(
      "SELECT * FROM sales_idempotency WHERE company_id=? AND operation_id=?",
      [companyId, operationId],
    );
    return row ? mapIdempotency(row) : null;
  }

  async add(record: SalesIdempotencyRecord): Promise<void> {
    try {
      await this.db.execute(
        `INSERT INTO sales_idempotency
         (company_id,request_id,operation_id,operation,payload_fingerprint,outcome_kind,
          outcome_id,outcome_version,outcome_status,result_json,recorded_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          record.companyId,
          record.requestId,
          record.operationId,
          record.operation,
          record.payloadFingerprint,
          record.outcomeKind,
          record.outcomeId,
          record.outcomeVersion,
          record.outcomeStatus,
          record.resultJson,
          record.recordedAt,
        ],
      );
    } catch (error) {
      const message = String(error).toLowerCase();
      if (message.includes("unique")) return fail("sales.idempotency_conflict", "idempotency");
      throw error;
    }
  }
}
