import type { DatabaseSession, DatabaseValue } from "@argin/database";
import {
  PurchaseApplicationError,
  createPurchaseCommercialTerms,
  rehydratePurchaseDocument,
  type NormalizedPurchaseDocumentListQuery,
  type PurchaseCommercialFactRepository,
  type PurchaseCommercialFactSnapshot,
  type PurchaseCommercialTerms,
  type PurchaseDocumentRepository,
  type PurchaseDocumentSnapshot,
  type PurchaseDocumentStatus,
  type PurchaseDocumentType,
  type PurchaseIdempotencyRecord,
  type PurchaseIdempotencyRepository,
  type PurchaseInventoryValuationCostInputSnapshot,
  type PurchaseItemSnapshot,
  type PurchaseReceiptInvoiceMatchRepository,
  type PurchaseReceiptInvoiceMatchSnapshot,
  type PurchaseUnresolvedValuationCostReference,
  type PurchaseValuationCostInputRepository,
} from "@argin/purchase";

const appError = (
  code: ConstructorParameters<typeof PurchaseApplicationError>[0],
  field: string,
): never => {
  throw new PurchaseApplicationError(code, field);
};

const errorText = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).toLowerCase();

const mapWriteError = (error: unknown, field = "persistence"): never => {
  if (error instanceof PurchaseApplicationError) throw error;
  const text = errorText(error);
  if (text.includes("purchase_documents") && text.includes("unique")) {
    return appError("PURCHASE_APP_INPUT_INVALID", "documentNumber");
  }
  if (text.includes("purchase_receipt_invoice_matches") && text.includes("unique")) {
    return appError("PURCHASE_APP_INPUT_INVALID", "matchId");
  }
  if (text.includes("purchase_valuation_cost_inputs") && text.includes("unique")) {
    return appError("PURCHASE_APP_INPUT_INVALID", "movementId");
  }
  if (text.includes("purchase_idempotency") && text.includes("unique")) {
    return appError("PURCHASE_APP_INPUT_INVALID", "requestId");
  }
  throw error;
};

type DocumentRow = {
  id: string;
  company_id: string;
  branch_id: string;
  supplier_id: string;
  document_type: PurchaseDocumentType;
  status: PurchaseDocumentStatus;
  document_number: string | null;
  business_date: string;
  description: string | null;
  fiscal_year_id: string;
  fiscal_period_id: string;
  supplier_snapshot_json: string;
  source_system: string | null;
  source_document_id: string | null;
  source_line_id: string | null;
  correction_reference_document_id: string | null;
  correction_reason: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  fiscal_year_start_date: string | null;
  fiscal_year_end_date: string | null;
  fiscal_period_start_date: string | null;
  fiscal_period_end_date: string | null;
  fiscal_year_status: "draft" | "open" | "closing" | "closed" | null;
  fiscal_period_status: "open" | "locked" | "closed" | null;
  locked_through_date: string | null;
};

type LineRow = {
  id: string;
  company_id: string;
  document_id: string;
  position: number;
  line_kind: PurchaseDocumentSnapshot["lines"][number]["lineKind"];
  item_type: PurchaseDocumentSnapshot["lines"][number]["itemType"];
  item_id: string;
  item_snapshot_json: string;
  description: string | null;
  source_system: string | null;
  source_document_id: string | null;
  source_line_id: string | null;
};

type LifecycleRow = {
  from_status: PurchaseDocumentStatus;
  to_status: PurchaseDocumentStatus;
  occurred_at: string;
  actor_user_id: string;
  reason: string | null;
  related_document_id: string | null;
};

type CommercialFactRow = {
  company_id: string;
  purchase_document_id: string;
  purchase_line_id: string;
  revision: number;
  commercial_terms_json: string;
  entered_quantity: string;
  base_quantity: string;
  entered_unit_id: string;
  base_unit_id: string;
  unit_price_amount: number;
  currency: string;
  tax_treatment: PurchaseCommercialTerms["tax"]["treatment"];
  tax_rate_basis_points: number | null;
};

type MatchRow = {
  match_id: string;
  company_id: string;
  invoice_document_id: string;
  invoice_line_id: string;
  receipt_document_id: string;
  receipt_line_id: string;
  product_id: string;
  matched_base_quantity: string;
};

type CostInputRow = {
  cost_input_id: string;
  company_id: string;
  movement_id: string;
  receipt_document_id: string;
  receipt_line_id: string;
  product_id: string;
  basis_line_id: string;
  warehouse_id: string;
  quantity: string;
  currency: string;
  base_cost: number;
  landed_cost: number;
  total_cost: number;
  unit_cost: string;
  sources_json: string;
  basis_json: string;
};

type UnresolvedMovementRow = {
  company_id: string;
  movement_id: string;
  receipt_document_id: string;
  receipt_line_id: string;
  product_id: string;
  quantity_delta: string;
};

const parseJson = <T>(value: string, field: string): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return appError("PURCHASE_APP_DEPENDENCY_INVALID", field);
  }
};

const sourceReference = (row: {
  source_system: string | null;
  source_document_id: string | null;
  source_line_id: string | null;
}) => row.source_system === null ? null : {
  sourceSystem: row.source_system,
  sourceDocumentId: row.source_document_id ?? "",
  sourceLineId: row.source_line_id,
};

const scopeValue = <T>(value: T | null, field: string): T => {
  if (value === null) return appError("PURCHASE_APP_DEPENDENCY_INVALID", field);
  return value;
};

const hydrateDocument = async (
  db: DatabaseSession,
  row: DocumentRow,
): Promise<PurchaseDocumentSnapshot> => {
  const lines = await db.query<LineRow>(
    `SELECT id,company_id,document_id,position,line_kind,item_type,item_id,item_snapshot_json,description,
            source_system,source_document_id,source_line_id
       FROM purchase_document_lines
      WHERE company_id=? AND document_id=?
      ORDER BY position,id`,
    [row.company_id, row.id],
  );
  const lifecycle = await db.query<LifecycleRow>(
    `SELECT from_status,to_status,occurred_at,actor_user_id,reason,related_document_id
       FROM purchase_document_lifecycle
      WHERE company_id=? AND document_id=?
      ORDER BY sequence`,
    [row.company_id, row.id],
  );

  return rehydratePurchaseDocument({
    scope: {
      companyId: row.company_id,
      branchId: row.branch_id,
      fiscalYearId: row.fiscal_year_id,
      fiscalPeriodId: row.fiscal_period_id,
      fiscalYearStartDate: scopeValue(row.fiscal_year_start_date, "scope.fiscalYearStartDate"),
      fiscalYearEndDate: scopeValue(row.fiscal_year_end_date, "scope.fiscalYearEndDate"),
      fiscalPeriodStartDate: scopeValue(row.fiscal_period_start_date, "scope.fiscalPeriodStartDate"),
      fiscalPeriodEndDate: scopeValue(row.fiscal_period_end_date, "scope.fiscalPeriodEndDate"),
      fiscalYearStatus: scopeValue(row.fiscal_year_status, "scope.fiscalYearStatus"),
      fiscalPeriodStatus: scopeValue(row.fiscal_period_status, "scope.fiscalPeriodStatus"),
      lockedThroughDate: row.locked_through_date,
    },
    documentId: row.id,
    companyId: row.company_id,
    supplierId: row.supplier_id,
    supplierSnapshot: parseJson(row.supplier_snapshot_json, "supplierSnapshot"),
    documentType: row.document_type,
    status: row.status,
    lifecycleHistory: Object.freeze(lifecycle.map(item => Object.freeze({
      fromStatus: item.from_status,
      toStatus: item.to_status,
      occurredAt: item.occurred_at,
      actorUserId: item.actor_user_id,
      reason: item.reason,
      relatedDocumentId: item.related_document_id,
    }))),
    documentNumber: row.document_number,
    businessDate: row.business_date,
    description: row.description,
    sourceReference: sourceReference(row),
    correctionReference: row.correction_reference_document_id === null ? null : {
      documentId: row.correction_reference_document_id,
      reason: row.correction_reason ?? "",
    },
    lines: Object.freeze(lines.map(line => Object.freeze({
      lineId: line.id,
      position: line.position,
      lineKind: line.line_kind,
      itemType: line.item_type,
      itemId: line.item_id,
      itemSnapshot: parseJson<PurchaseItemSnapshot>(line.item_snapshot_json, "itemSnapshot"),
      description: line.description,
      sourceReference: sourceReference(line),
    }))),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
};

const writeLine = async (
  db: DatabaseSession,
  document: PurchaseDocumentSnapshot,
  line: PurchaseDocumentSnapshot["lines"][number],
): Promise<void> => {
  const source = line.sourceReference;
  await db.execute(
    `INSERT INTO purchase_document_lines
      (id,company_id,document_id,position,line_kind,item_type,item_id,item_snapshot_json,description,
       source_system,source_document_id,source_line_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      line.lineId, document.companyId, document.documentId, line.position, line.lineKind, line.itemType,
      line.itemId, JSON.stringify(line.itemSnapshot), line.description,
      source?.sourceSystem ?? null, source?.sourceDocumentId ?? null, source?.sourceLineId ?? null,
    ],
  );
};

const appendMissingLifecycle = async (
  db: DatabaseSession,
  document: PurchaseDocumentSnapshot,
): Promise<void> => {
  const count = await db.queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM purchase_document_lifecycle WHERE company_id=? AND document_id=?",
    [document.companyId, document.documentId],
  );
  const persisted = Number(count?.count ?? 0);
  for (let index = persisted; index < document.lifecycleHistory.length; index += 1) {
    const item = document.lifecycleHistory[index];
    if (!item) continue;
    await db.execute(
      `INSERT INTO purchase_document_lifecycle
       (document_id,company_id,sequence,from_status,to_status,occurred_at,actor_user_id,reason,related_document_id)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        document.documentId, document.companyId, index + 1, item.fromStatus, item.toStatus,
        item.occurredAt, item.actorUserId, item.reason, item.relatedDocumentId,
      ],
    );
  }
};

export class SqlitePurchaseDocumentRepository implements PurchaseDocumentRepository {
  constructor(private readonly db: DatabaseSession) {}

  async findById(companyId: string, documentId: string): Promise<PurchaseDocumentSnapshot | null> {
    const row = await this.db.queryOne<DocumentRow>(
      "SELECT * FROM purchase_documents WHERE company_id=? AND id=?",
      [companyId, documentId],
    );
    return row ? hydrateDocument(this.db, row) : null;
  }

  async findByNumber(
    companyId: string,
    fiscalYearId: string,
    branchId: string,
    documentType: PurchaseDocumentType,
    documentNumber: string,
  ): Promise<PurchaseDocumentSnapshot | null> {
    const row = await this.db.queryOne<DocumentRow>(
      `SELECT * FROM purchase_documents
        WHERE company_id=? AND fiscal_year_id=? AND branch_id=? AND document_type=? AND document_number=?`,
      [companyId, fiscalYearId, branchId, documentType, documentNumber],
    );
    return row ? hydrateDocument(this.db, row) : null;
  }

  async list(query: NormalizedPurchaseDocumentListQuery): Promise<readonly PurchaseDocumentSnapshot[]> {
    const where = ["company_id=?"];
    const parameters: DatabaseValue[] = [query.companyId];
    if (query.branchId !== null) { where.push("branch_id=?"); parameters.push(query.branchId); }
    if (query.supplierId !== null) { where.push("supplier_id=?"); parameters.push(query.supplierId); }
    if (query.documentType !== null) { where.push("document_type=?"); parameters.push(query.documentType); }
    if (query.status !== null) { where.push("status=?"); parameters.push(query.status); }
    if (query.fromBusinessDate !== null) { where.push("business_date>=?"); parameters.push(query.fromBusinessDate); }
    if (query.toBusinessDate !== null) { where.push("business_date<=?"); parameters.push(query.toBusinessDate); }
    parameters.push(query.limit, query.offset);
    const rows = await this.db.query<DocumentRow>(
      `SELECT * FROM purchase_documents
        WHERE ${where.join(" AND ")}
        ORDER BY business_date DESC,id
        LIMIT ? OFFSET ?`,
      parameters,
    );
    return Object.freeze(await Promise.all(rows.map(row => hydrateDocument(this.db, row))));
  }

  async add(document: PurchaseDocumentSnapshot): Promise<void> {
    const source = document.sourceReference;
    const correction = document.correctionReference;
    const scope = document.scope;
    try {
      await this.db.execute(
        `INSERT INTO purchase_documents
         (id,company_id,branch_id,supplier_id,document_type,status,document_number,business_date,description,
          fiscal_year_id,fiscal_period_id,supplier_snapshot_json,source_system,source_document_id,source_line_id,
          correction_reference_document_id,correction_reason,version,created_at,updated_at,sync_origin,sync_changed_at,
          fiscal_year_start_date,fiscal_year_end_date,fiscal_period_start_date,fiscal_period_end_date,
          fiscal_year_status,fiscal_period_status,locked_through_date)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          document.documentId, document.companyId, scope.branchId, document.supplierId, document.documentType,
          document.status, document.documentNumber, document.businessDate, document.description,
          scope.fiscalYearId, scope.fiscalPeriodId, JSON.stringify(document.supplierSnapshot),
          source?.sourceSystem ?? null, source?.sourceDocumentId ?? null, source?.sourceLineId ?? null,
          correction?.documentId ?? null, correction?.reason ?? null, document.version,
          document.createdAt, document.updatedAt, "local", document.updatedAt,
          scope.fiscalYearStartDate, scope.fiscalYearEndDate, scope.fiscalPeriodStartDate, scope.fiscalPeriodEndDate,
          scope.fiscalYearStatus, scope.fiscalPeriodStatus, scope.lockedThroughDate,
        ],
      );
      for (const line of document.lines) await writeLine(this.db, document, line);
      await appendMissingLifecycle(this.db, document);
    } catch (error) {
      mapWriteError(error);
    }
  }

  async update(document: PurchaseDocumentSnapshot, expectedVersion: number): Promise<void> {
    const source = document.sourceReference;
    const correction = document.correctionReference;
    const scope = document.scope;
    try {
      const result = await this.db.execute(
        `UPDATE purchase_documents SET
          branch_id=?,supplier_id=?,document_type=?,status=?,document_number=?,business_date=?,description=?,
          fiscal_year_id=?,fiscal_period_id=?,supplier_snapshot_json=?,source_system=?,source_document_id=?,source_line_id=?,
          correction_reference_document_id=?,correction_reason=?,version=?,updated_at=?,sync_changed_at=?,
          fiscal_year_start_date=?,fiscal_year_end_date=?,fiscal_period_start_date=?,fiscal_period_end_date=?,
          fiscal_year_status=?,fiscal_period_status=?,locked_through_date=?
         WHERE company_id=? AND id=? AND version=?`,
        [
          scope.branchId, document.supplierId, document.documentType, document.status, document.documentNumber,
          document.businessDate, document.description, scope.fiscalYearId, scope.fiscalPeriodId,
          JSON.stringify(document.supplierSnapshot), source?.sourceSystem ?? null, source?.sourceDocumentId ?? null,
          source?.sourceLineId ?? null, correction?.documentId ?? null, correction?.reason ?? null,
          document.version, document.updatedAt, document.updatedAt,
          scope.fiscalYearStartDate, scope.fiscalYearEndDate, scope.fiscalPeriodStartDate, scope.fiscalPeriodEndDate,
          scope.fiscalYearStatus, scope.fiscalPeriodStatus, scope.lockedThroughDate,
          document.companyId, document.documentId, expectedVersion,
        ],
      );
      if (result.rowsAffected !== 1) {
        const exists = await this.db.queryOne<{ version: number }>(
          "SELECT version FROM purchase_documents WHERE company_id=? AND id=?",
          [document.companyId, document.documentId],
        );
        return appError(
          exists ? "PURCHASE_APP_VERSION_CONFLICT" : "PURCHASE_APP_NOT_FOUND",
          exists ? "expectedVersion" : "documentId",
        );
      }
      await appendMissingLifecycle(this.db, document);
    } catch (error) {
      mapWriteError(error);
    }
  }
}

const hydrateCommercialFact = (row: CommercialFactRow): PurchaseCommercialFactSnapshot => {
  const persisted = parseJson<PurchaseCommercialTerms>(row.commercial_terms_json, "commercialTerms");
  const commercialTerms = createPurchaseCommercialTerms({
    enteredQuantity: persisted.quantity.enteredQuantity,
    enteredUnit: persisted.quantity.enteredUnit,
    baseUnit: persisted.quantity.baseUnit,
    unitPrice: persisted.unitPrice,
    discounts: persisted.discounts,
    charges: persisted.charges,
    tax: persisted.tax,
  });
  if (
    commercialTerms.quantity.enteredQuantity !== row.entered_quantity ||
    commercialTerms.quantity.baseQuantity !== row.base_quantity ||
    commercialTerms.quantity.enteredUnit.unitId !== row.entered_unit_id ||
    commercialTerms.quantity.baseUnit.unitId !== row.base_unit_id ||
    commercialTerms.unitPrice.amount !== row.unit_price_amount ||
    commercialTerms.unitPrice.currency !== row.currency ||
    commercialTerms.tax.treatment !== row.tax_treatment ||
    commercialTerms.tax.rateBasisPoints !== row.tax_rate_basis_points
  ) {
    return appError("PURCHASE_APP_DEPENDENCY_INVALID", "commercialTerms");
  }
  return Object.freeze({
    companyId: row.company_id,
    purchaseDocumentId: row.purchase_document_id,
    purchaseLineId: row.purchase_line_id,
    commercialTerms,
    revision: row.revision,
  });
};

const commercialValues = (fact: PurchaseCommercialFactSnapshot, timestamp: string): readonly DatabaseValue[] => {
  const terms = fact.commercialTerms;
  return [
    fact.companyId, fact.purchaseDocumentId, fact.purchaseLineId, fact.revision, JSON.stringify(terms),
    terms.quantity.enteredQuantity, terms.quantity.baseQuantity,
    terms.quantity.enteredUnit.unitId, terms.quantity.baseUnit.unitId,
    terms.unitPrice.amount, terms.unitPrice.currency, terms.tax.treatment, terms.tax.rateBasisPoints,
    timestamp, "local", timestamp,
  ];
};

export class SqlitePurchaseCommercialFactRepository implements PurchaseCommercialFactRepository {
  constructor(private readonly db: DatabaseSession) {}

  async findByLine(
    companyId: string,
    purchaseDocumentId: string,
    purchaseLineId: string,
  ): Promise<PurchaseCommercialFactSnapshot | null> {
    const row = await this.db.queryOne<CommercialFactRow>(
      `SELECT company_id,purchase_document_id,purchase_line_id,revision,commercial_terms_json,
              entered_quantity,base_quantity,entered_unit_id,base_unit_id,unit_price_amount,currency,
              tax_treatment,tax_rate_basis_points
         FROM purchase_commercial_facts
        WHERE company_id=? AND purchase_document_id=? AND purchase_line_id=?`,
      [companyId, purchaseDocumentId, purchaseLineId],
    );
    return row ? hydrateCommercialFact(row) : null;
  }

  async listByDocument(companyId: string, purchaseDocumentId: string): Promise<readonly PurchaseCommercialFactSnapshot[]> {
    const rows = await this.db.query<CommercialFactRow>(
      `SELECT company_id,purchase_document_id,purchase_line_id,revision,commercial_terms_json,
              entered_quantity,base_quantity,entered_unit_id,base_unit_id,unit_price_amount,currency,
              tax_treatment,tax_rate_basis_points
         FROM purchase_commercial_facts
        WHERE company_id=? AND purchase_document_id=?
        ORDER BY purchase_line_id`,
      [companyId, purchaseDocumentId],
    );
    return Object.freeze(rows.map(hydrateCommercialFact));
  }

  async addBatch(facts: readonly PurchaseCommercialFactSnapshot[]): Promise<void> {
    const timestamp = new Date().toISOString();
    try {
      for (const fact of facts) {
        await this.db.execute(
          `INSERT INTO purchase_commercial_facts
           (company_id,purchase_document_id,purchase_line_id,revision,commercial_terms_json,
            entered_quantity,base_quantity,entered_unit_id,base_unit_id,unit_price_amount,currency,
            tax_treatment,tax_rate_basis_points,updated_at,sync_origin,sync_changed_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          commercialValues(fact, timestamp),
        );
      }
    } catch (error) {
      mapWriteError(error, "commercialFacts");
    }
  }

  async replaceBatch(
    companyId: string,
    purchaseDocumentId: string,
    facts: readonly PurchaseCommercialFactSnapshot[],
    expectedRevision: number,
  ): Promise<void> {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
      return appError("PURCHASE_APP_INPUT_INVALID", "expectedRevision");
    }
    const timestamp = new Date().toISOString();
    for (const fact of facts) {
      if (
        fact.companyId !== companyId ||
        fact.purchaseDocumentId !== purchaseDocumentId ||
        fact.revision !== expectedRevision + 1
      ) {
        return appError("PURCHASE_APP_INPUT_INVALID", "commercialFacts.revision");
      }
      const terms = fact.commercialTerms;
      const result = await this.db.execute(
        `UPDATE purchase_commercial_facts SET
          revision=?,commercial_terms_json=?,entered_quantity=?,base_quantity=?,entered_unit_id=?,base_unit_id=?,
          unit_price_amount=?,currency=?,tax_treatment=?,tax_rate_basis_points=?,updated_at=?,sync_changed_at=?
         WHERE company_id=? AND purchase_document_id=? AND purchase_line_id=? AND revision=?`,
        [
          fact.revision, JSON.stringify(terms), terms.quantity.enteredQuantity, terms.quantity.baseQuantity,
          terms.quantity.enteredUnit.unitId, terms.quantity.baseUnit.unitId, terms.unitPrice.amount,
          terms.unitPrice.currency, terms.tax.treatment, terms.tax.rateBasisPoints, timestamp, timestamp,
          companyId, purchaseDocumentId, fact.purchaseLineId, expectedRevision,
        ],
      );
      if (result.rowsAffected !== 1) {
        return appError("PURCHASE_APP_VERSION_CONFLICT", "commercialFacts.revision");
      }
    }
  }
}

const mapMatch = (row: MatchRow): PurchaseReceiptInvoiceMatchSnapshot => Object.freeze({
  matchId: row.match_id,
  companyId: row.company_id,
  invoiceDocumentId: row.invoice_document_id,
  invoiceLineId: row.invoice_line_id,
  receiptDocumentId: row.receipt_document_id,
  receiptLineId: row.receipt_line_id,
  productId: row.product_id,
  matchedBaseQuantity: row.matched_base_quantity,
});

const matchSelect = `SELECT match_id,company_id,invoice_document_id,invoice_line_id,
 receipt_document_id,receipt_line_id,product_id,matched_base_quantity
 FROM purchase_receipt_invoice_matches`;

export class SqlitePurchaseReceiptInvoiceMatchRepository implements PurchaseReceiptInvoiceMatchRepository {
  constructor(private readonly db: DatabaseSession) {}

  async findById(companyId: string, matchId: string): Promise<PurchaseReceiptInvoiceMatchSnapshot | null> {
    const row = await this.db.queryOne<MatchRow>(
      `${matchSelect} WHERE company_id=? AND match_id=?`,
      [companyId, matchId],
    );
    return row ? mapMatch(row) : null;
  }

  async listByInvoiceLine(
    companyId: string,
    invoiceDocumentId: string,
    invoiceLineId: string,
  ): Promise<readonly PurchaseReceiptInvoiceMatchSnapshot[]> {
    const rows = await this.db.query<MatchRow>(
      `${matchSelect}
        WHERE company_id=? AND invoice_document_id=? AND invoice_line_id=?
        ORDER BY match_id`,
      [companyId, invoiceDocumentId, invoiceLineId],
    );
    return Object.freeze(rows.map(mapMatch));
  }

  async listByReceiptLine(
    companyId: string,
    receiptDocumentId: string,
    receiptLineId: string,
  ): Promise<readonly PurchaseReceiptInvoiceMatchSnapshot[]> {
    const rows = await this.db.query<MatchRow>(
      `${matchSelect}
        WHERE company_id=? AND receipt_document_id=? AND receipt_line_id=?
        ORDER BY match_id`,
      [companyId, receiptDocumentId, receiptLineId],
    );
    return Object.freeze(rows.map(mapMatch));
  }

  async add(match: PurchaseReceiptInvoiceMatchSnapshot): Promise<void> {
    const timestamp = new Date().toISOString();
    try {
      await this.db.execute(
        `INSERT INTO purchase_receipt_invoice_matches
         (match_id,company_id,invoice_document_id,invoice_line_id,receipt_document_id,receipt_line_id,
          product_id,matched_base_quantity,created_at,sync_origin,sync_changed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          match.matchId, match.companyId, match.invoiceDocumentId, match.invoiceLineId,
          match.receiptDocumentId, match.receiptLineId, match.productId, match.matchedBaseQuantity,
          timestamp, "local", timestamp,
        ],
      );
    } catch (error) {
      mapWriteError(error, "matchId");
    }
  }
}

const hydrateCostInput = (row: CostInputRow): PurchaseInventoryValuationCostInputSnapshot => {
  const sources = parseJson<PurchaseInventoryValuationCostInputSnapshot["sources"]>(row.sources_json, "sources");
  const basis = parseJson<PurchaseInventoryValuationCostInputSnapshot["basis"]>(row.basis_json, "basis");
  if (
    basis.basisLineId !== row.basis_line_id ||
    basis.movementId !== row.movement_id ||
    basis.productId !== row.product_id ||
    basis.warehouseId !== row.warehouse_id ||
    basis.quantity !== row.quantity ||
    basis.currency !== row.currency ||
    basis.baseCost !== row.base_cost ||
    basis.landedCost !== row.landed_cost ||
    basis.totalCost !== row.total_cost ||
    basis.unitCost !== row.unit_cost
  ) {
    return appError("PURCHASE_APP_DEPENDENCY_INVALID", "costInput.basis");
  }
  return Object.freeze({
    costInputId: row.cost_input_id,
    companyId: row.company_id,
    movementId: row.movement_id,
    receiptDocumentId: row.receipt_document_id,
    receiptLineId: row.receipt_line_id,
    productId: row.product_id,
    sources: Object.freeze([...sources]),
    basis: Object.freeze({ ...basis, allocations: Object.freeze([]) as readonly [] }),
  });
};

type Decimal = { coefficient: bigint; scale: number };

const parseDecimal = (value: string): Decimal => {
  if (!/^\d+(?:\.\d+)?$/u.test(value)) return appError("PURCHASE_APP_DEPENDENCY_INVALID", "quantity");
  const [whole = "0", fraction = ""] = value.split(".");
  return { coefficient: BigInt(whole + fraction), scale: fraction.length };
};

const addDecimal = (left: Decimal, right: Decimal): Decimal => {
  const scale = Math.max(left.scale, right.scale);
  return {
    coefficient: left.coefficient * 10n ** BigInt(scale - left.scale)
      + right.coefficient * 10n ** BigInt(scale - right.scale),
    scale,
  };
};

const compareDecimal = (left: Decimal, right: Decimal): number => {
  const scale = Math.max(left.scale, right.scale);
  const a = left.coefficient * 10n ** BigInt(scale - left.scale);
  const b = right.coefficient * 10n ** BigInt(scale - right.scale);
  return a === b ? 0 : a < b ? -1 : 1;
};

export class SqlitePurchaseValuationCostInputRepository implements PurchaseValuationCostInputRepository {
  constructor(private readonly db: DatabaseSession) {}

  async findByMovement(companyId: string, movementId: string): Promise<PurchaseInventoryValuationCostInputSnapshot | null> {
    const row = await this.db.queryOne<CostInputRow>(
      "SELECT * FROM purchase_valuation_cost_inputs WHERE company_id=? AND movement_id=?",
      [companyId, movementId],
    );
    return row ? hydrateCostInput(row) : null;
  }

  async listUnresolvedByCompany(companyId: string): Promise<readonly PurchaseUnresolvedValuationCostReference[]> {
    const movements = await this.db.query<UnresolvedMovementRow>(
      `SELECT m.company_id,m.movement_id,m.document_id AS receipt_document_id,m.line_id AS receipt_line_id,
              m.product_id,m.quantity_delta
         FROM inventory_stock_movements m
         JOIN inventory_documents d ON d.company_id=m.company_id AND d.id=m.document_id
         LEFT JOIN purchase_valuation_cost_inputs c ON c.company_id=m.company_id AND c.movement_id=m.movement_id
        WHERE m.company_id=? AND d.document_type='receipt' AND d.status='confirmed'
          AND d.source_system='purchase' AND c.cost_input_id IS NULL
        ORDER BY m.business_date,m.business_order,m.movement_id`,
      [companyId],
    );
    const matchesRepository = new SqlitePurchaseReceiptInvoiceMatchRepository(this.db);
    const commercialRepository = new SqlitePurchaseCommercialFactRepository(this.db);
    const documentsRepository = new SqlitePurchaseDocumentRepository(this.db);
    const unresolved: PurchaseUnresolvedValuationCostReference[] = [];

    for (const movement of movements) {
      const matches = await matchesRepository.listByReceiptLine(
        movement.company_id,
        movement.receipt_document_id,
        movement.receipt_line_id,
      );
      let reason: PurchaseUnresolvedValuationCostReference["reason"] | null = null;
      if (matches.length === 0) {
        reason = "awaiting-supplier-invoice";
      } else {
        let matched: Decimal = { coefficient: 0n, scale: 0 };
        for (const match of matches) matched = addDecimal(matched, parseDecimal(match.matchedBaseQuantity));
        const coverage = compareDecimal(matched, parseDecimal(movement.quantity_delta));
        if (coverage < 0) {
          reason = "partial-invoice-match";
        } else if (coverage > 0) {
          return appError("PURCHASE_APP_DEPENDENCY_INVALID", "matches.matchedBaseQuantity");
        } else {
          for (const match of matches) {
            const invoice = await documentsRepository.findById(companyId, match.invoiceDocumentId);
            const commercial = await commercialRepository.findByLine(companyId, match.invoiceDocumentId, match.invoiceLineId);
            if (!invoice || invoice.status !== "confirmed" || invoice.documentType !== "supplier-invoice" || !commercial) {
              reason = "supplier-invoice-cost-unavailable";
              break;
            }
          }
        }
      }
      if (reason !== null) {
        unresolved.push(Object.freeze({
          companyId: movement.company_id,
          movementId: movement.movement_id,
          receiptDocumentId: movement.receipt_document_id,
          receiptLineId: movement.receipt_line_id,
          productId: movement.product_id,
          reason,
        }));
      }
    }
    return Object.freeze(unresolved);
  }

  async add(costInput: PurchaseInventoryValuationCostInputSnapshot): Promise<void> {
    const timestamp = new Date().toISOString();
    try {
      await this.db.execute(
        `INSERT INTO purchase_valuation_cost_inputs
         (cost_input_id,company_id,movement_id,receipt_document_id,receipt_line_id,product_id,
          basis_line_id,warehouse_id,quantity,currency,base_cost,landed_cost,total_cost,unit_cost,
          sources_json,basis_json,revision,created_at,updated_at,sync_origin,sync_changed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          costInput.costInputId, costInput.companyId, costInput.movementId, costInput.receiptDocumentId,
          costInput.receiptLineId, costInput.productId, costInput.basis.basisLineId, costInput.basis.warehouseId,
          costInput.basis.quantity, costInput.basis.currency, costInput.basis.baseCost, costInput.basis.landedCost,
          costInput.basis.totalCost, costInput.basis.unitCost, JSON.stringify(costInput.sources),
          JSON.stringify(costInput.basis), 1, timestamp, timestamp, "local", timestamp,
        ],
      );
    } catch (error) {
      mapWriteError(error, "costInput");
    }
  }

  async replaceForMovement(
    companyId: string,
    movementId: string,
    costInput: PurchaseInventoryValuationCostInputSnapshot,
  ): Promise<void> {
    if (costInput.companyId !== companyId || costInput.movementId !== movementId) {
      return appError("PURCHASE_APP_SCOPE_MISMATCH", "costInput.movementId");
    }
    const timestamp = new Date().toISOString();
    const result = await this.db.execute(
      `UPDATE purchase_valuation_cost_inputs SET
        cost_input_id=?,receipt_document_id=?,receipt_line_id=?,product_id=?,basis_line_id=?,warehouse_id=?,
        quantity=?,currency=?,base_cost=?,landed_cost=?,total_cost=?,unit_cost=?,sources_json=?,basis_json=?,
        revision=revision+1,updated_at=?,sync_changed_at=?
       WHERE company_id=? AND movement_id=?`,
      [
        costInput.costInputId, costInput.receiptDocumentId, costInput.receiptLineId, costInput.productId,
        costInput.basis.basisLineId, costInput.basis.warehouseId, costInput.basis.quantity,
        costInput.basis.currency, costInput.basis.baseCost, costInput.basis.landedCost, costInput.basis.totalCost,
        costInput.basis.unitCost, JSON.stringify(costInput.sources), JSON.stringify(costInput.basis),
        timestamp, timestamp, companyId, movementId,
      ],
    );
    if (result.rowsAffected !== 1) return appError("PURCHASE_APP_NOT_FOUND", "movementId");
  }
}


type IdempotencyRow = {
  company_id: string;
  request_id: string;
  operation_id: string;
  operation: string;
  payload_fingerprint: string;
  outcome_kind: PurchaseIdempotencyRecord["outcomeKind"];
  outcome_id: string;
  outcome_version: number | null;
  outcome_status: string | null;
  result_json: string;
  recorded_at: string;
};

const mapIdempotency = (row: IdempotencyRow): PurchaseIdempotencyRecord => Object.freeze({
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

export class SqlitePurchaseIdempotencyRepository implements PurchaseIdempotencyRepository {
  constructor(private readonly db: DatabaseSession) {}

  async findByRequestId(companyId: string, requestId: string): Promise<PurchaseIdempotencyRecord | null> {
    const row = await this.db.queryOne<IdempotencyRow>(
      "SELECT * FROM purchase_idempotency WHERE company_id=? AND request_id=?",
      [companyId, requestId],
    );
    return row ? mapIdempotency(row) : null;
  }

  async findByOperationId(companyId: string, operationId: string): Promise<PurchaseIdempotencyRecord | null> {
    const row = await this.db.queryOne<IdempotencyRow>(
      "SELECT * FROM purchase_idempotency WHERE company_id=? AND operation_id=?",
      [companyId, operationId],
    );
    return row ? mapIdempotency(row) : null;
  }

  async add(record: PurchaseIdempotencyRecord): Promise<void> {
    try {
      await this.db.execute(
        `INSERT INTO purchase_idempotency
         (company_id,request_id,operation_id,operation,payload_fingerprint,outcome_kind,outcome_id,
          outcome_version,outcome_status,recorded_at,result_json)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          record.companyId, record.requestId, record.operationId, record.operation, record.payloadFingerprint,
          record.outcomeKind, record.outcomeId, record.outcomeVersion, record.outcomeStatus,
          record.recordedAt, record.resultJson,
        ],
      );
    } catch (error) {
      const text = errorText(error);
      if (text.includes("purchase_idempotency") || text.includes("request_id") || text.includes("operation_id")) {
        return appError("PURCHASE_APP_IDEMPOTENCY_CONFLICT", "requestId");
      }
      throw error;
    }
  }
}
