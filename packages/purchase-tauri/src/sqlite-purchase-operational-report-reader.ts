import type { DatabaseExecutor, DatabaseValue } from "@argin/database";
import {
  buildPurchaseDocumentRegisterRow,
  buildPurchaseSupplierActivitySummary,
  calculatePurchaseMatchingStatus,
  normalizePurchaseOperationalReportQuery,
  type NormalizedPurchaseOperationalReportQuery,
  type PurchaseDocumentRegisterReport,
  type PurchaseInvoiceMatchingReport,
  type PurchaseInvoiceMatchingReportRow,
  type PurchaseOperationalReportQuery,
  type PurchaseOperationalReportReader,
  type PurchaseSupplierActivitySummaryReport,
  type PurchaseSupplierSnapshot,
  type PurchaseUnresolvedCostReport,
  type PurchaseUnresolvedCostReportRow,
} from "@argin/purchase";
import {
  SqlitePurchaseCommercialFactRepository,
  SqlitePurchaseDocumentRepository,
  SqlitePurchaseReceiptInvoiceMatchRepository,
} from "./sqlite-purchase-repositories.ts";

type IdRow = { id: string };
type SupplierSeedRow = { supplier_id: string };
type MatchingSeedRow = {
  invoice_document_id: string;
  invoice_document_number: string | null;
  invoice_line_id: string;
  business_date: string;
  branch_id: string;
  supplier_id: string;
  supplier_snapshot_json: string;
  product_id: string;
  item_snapshot_json: string;
  base_quantity: string;
  entered_unit_title: string;
};
type UnresolvedSeedRow = {
  movement_id: string;
  receipt_document_id: string;
  receipt_document_number: string | null;
  receipt_line_id: string;
  business_date: string;
  branch_id: string | null;
  product_id: string;
  product_code: string;
  product_title: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_title: string;
  quantity_delta: string;
};

const parse = <T>(value: string, field: string): T => {
  try { return JSON.parse(value) as T; }
  catch { throw new TypeError("purchase.report_dependency_invalid:" + field); }
};

function filterParts(
  query: NormalizedPurchaseOperationalReportQuery,
  alias: string,
): { where: string[]; params: DatabaseValue[] } {
  const where = [alias + ".company_id=?"];
  const params: DatabaseValue[] = [query.companyId];
  if (query.branchId !== null) { where.push(alias + ".branch_id=?"); params.push(query.branchId); }
  if (query.fiscalYearId !== null) { where.push(alias + ".fiscal_year_id=?"); params.push(query.fiscalYearId); }
  if (query.supplierId !== null) { where.push(alias + ".supplier_id=?"); params.push(query.supplierId); }
  if (query.fromBusinessDate !== null) { where.push(alias + ".business_date>=?"); params.push(query.fromBusinessDate); }
  if (query.toBusinessDate !== null) { where.push(alias + ".business_date<=?"); params.push(query.toBusinessDate); }
  return { where, params };
}

export class SqlitePurchaseOperationalReportReader implements PurchaseOperationalReportReader {
  private readonly documents: SqlitePurchaseDocumentRepository;
  private readonly commercialFacts: SqlitePurchaseCommercialFactRepository;
  private readonly matches: SqlitePurchaseReceiptInvoiceMatchRepository;

  constructor(private readonly database: DatabaseExecutor) {
    this.documents = new SqlitePurchaseDocumentRepository(database);
    this.commercialFacts = new SqlitePurchaseCommercialFactRepository(database);
    this.matches = new SqlitePurchaseReceiptInvoiceMatchRepository(database);
  }

  async readDocumentRegister(queryInput: PurchaseOperationalReportQuery): Promise<PurchaseDocumentRegisterReport> {
    const query = normalizePurchaseOperationalReportQuery(queryInput);
    const filter = filterParts(query, "d");
    const rows = await this.database.query<IdRow>(
      "SELECT d.id FROM purchase_documents d WHERE " + filter.where.join(" AND ") +
      " ORDER BY d.business_date DESC,d.id LIMIT ? OFFSET ?",
      [...filter.params, query.limit + 1, query.offset],
    );
    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    const items = [];
    for (const row of page) {
      const document = await this.documents.findById(query.companyId, row.id);
      if (!document) throw new TypeError("purchase.report_dependency_invalid:document");
      const facts = await this.commercialFacts.listByDocument(query.companyId, row.id);
      items.push(buildPurchaseDocumentRegisterRow(document, facts));
    }
    return Object.freeze({
      items: Object.freeze(items),
      nextOffset: hasMore ? query.offset + query.limit : null,
    });
  }

  async readSupplierActivity(queryInput: PurchaseOperationalReportQuery): Promise<PurchaseSupplierActivitySummaryReport> {
    const query = normalizePurchaseOperationalReportQuery(queryInput);
    const filter = filterParts(query, "d");
    filter.where.push("d.document_type IN ('supplier-invoice','purchase-return','purchase-correction')");
    filter.where.push("((d.document_type='supplier-invoice' AND d.status IN ('confirmed','returned','corrected')) OR (d.document_type<>'supplier-invoice' AND d.status='confirmed'))");

    const suppliers = await this.database.query<SupplierSeedRow>(
      "SELECT DISTINCT d.supplier_id FROM purchase_documents d WHERE " + filter.where.join(" AND ") +
      " ORDER BY d.supplier_id LIMIT ? OFFSET ?",
      [...filter.params, query.limit, query.offset],
    );

    const rows = [];
    for (const supplier of suppliers) {
      let offset = 0;
      while (true) {
        const page = await this.readDocumentRegister({
          ...query,
          supplierId: supplier.supplier_id,
          limit: 500,
          offset,
        });
        rows.push(...page.items);
        if (page.nextOffset === null) break;
        offset = page.nextOffset;
      }
    }
    return Object.freeze({
      items: buildPurchaseSupplierActivitySummary(rows),
    });
  }

  async readInvoiceMatching(queryInput: PurchaseOperationalReportQuery): Promise<PurchaseInvoiceMatchingReport> {
    const query = normalizePurchaseOperationalReportQuery(queryInput);
    const filter = filterParts(query, "d");
    filter.where.push("d.document_type='supplier-invoice'");
    filter.where.push("d.status IN ('confirmed','returned','corrected')");
    const seeds = await this.database.query<MatchingSeedRow>(
      "SELECT d.id AS invoice_document_id,d.document_number AS invoice_document_number," +
      "l.id AS invoice_line_id,d.business_date,d.branch_id,d.supplier_id,d.supplier_snapshot_json," +
      "l.item_id AS product_id,l.item_snapshot_json,c.base_quantity," +
      "json_extract(c.commercial_terms_json,'$.quantity.enteredUnit.title') AS entered_unit_title " +
      "FROM purchase_documents d " +
      "JOIN purchase_document_lines l ON l.company_id=d.company_id AND l.document_id=d.id " +
      "JOIN purchase_commercial_facts c ON c.company_id=d.company_id AND c.purchase_document_id=d.id AND c.purchase_line_id=l.id " +
      "WHERE " + filter.where.join(" AND ") +
      " ORDER BY d.business_date DESC,d.id,l.position,l.id LIMIT ? OFFSET ?",
      [...filter.params, query.limit + 1, query.offset],
    );
    const hasMore = seeds.length > query.limit;
    const items: PurchaseInvoiceMatchingReportRow[] = [];
    for (const seed of seeds.slice(0, query.limit)) {
      const matchRows = await this.matches.listByInvoiceLine(query.companyId, seed.invoice_document_id, seed.invoice_line_id);
      const status = calculatePurchaseMatchingStatus(seed.base_quantity, matchRows.map(item => item.matchedBaseQuantity));
      const supplier = parse<PurchaseSupplierSnapshot>(seed.supplier_snapshot_json, "supplierSnapshot");
      const item = parse<{ code: string; displayName: string }>(seed.item_snapshot_json, "itemSnapshot");
      items.push(Object.freeze({
        invoiceDocumentId: seed.invoice_document_id,
        invoiceDocumentNumber: seed.invoice_document_number,
        invoiceLineId: seed.invoice_line_id,
        businessDate: seed.business_date,
        branchId: seed.branch_id,
        supplierId: seed.supplier_id,
        supplierCode: supplier.code,
        supplierDisplayName: supplier.displayName,
        productId: seed.product_id,
        productCode: item.code,
        productDisplayName: item.displayName,
        unitTitle: seed.entered_unit_title,
        ...status,
      }));
    }
    return Object.freeze({
      items: Object.freeze(items),
      nextOffset: hasMore ? query.offset + query.limit : null,
    });
  }

  async readUnresolvedCosts(queryInput: PurchaseOperationalReportQuery): Promise<PurchaseUnresolvedCostReport> {
    const query = normalizePurchaseOperationalReportQuery(queryInput);
    if (query.supplierId !== null) throw new TypeError("purchase.report_input_invalid:supplierId");
    const where = [
      "m.company_id=?",
      "d.document_type='receipt'",
      "d.status='confirmed'",
      "d.source_system='purchase'",
      "c.cost_input_id IS NULL",
    ];
    const params: DatabaseValue[] = [query.companyId];
    if (query.branchId !== null) { where.push("d.origin_branch_id=?"); params.push(query.branchId); }
    if (query.fiscalYearId !== null) { where.push("d.fiscal_year_id=?"); params.push(query.fiscalYearId); }
    if (query.fromBusinessDate !== null) { where.push("m.business_date>=?"); params.push(query.fromBusinessDate); }
    if (query.toBusinessDate !== null) { where.push("m.business_date<=?"); params.push(query.toBusinessDate); }

    const seeds = await this.database.query<UnresolvedSeedRow>(
      "SELECT m.movement_id,m.document_id AS receipt_document_id,d.document_number AS receipt_document_number," +
      "m.line_id AS receipt_line_id,m.business_date,d.origin_branch_id AS branch_id,m.product_id," +
      "p.code AS product_code,p.title AS product_title,m.warehouse_id,w.code AS warehouse_code,w.title AS warehouse_title," +
      "m.quantity_delta FROM inventory_stock_movements m " +
      "JOIN inventory_documents d ON d.company_id=m.company_id AND d.id=m.document_id " +
      "JOIN products p ON p.company_id=m.company_id AND p.id=m.product_id " +
      "JOIN warehouses w ON w.company_id=m.company_id AND w.id=m.warehouse_id " +
      "LEFT JOIN purchase_valuation_cost_inputs c ON c.company_id=m.company_id AND c.movement_id=m.movement_id " +
      "WHERE " + where.join(" AND ") +
      " ORDER BY m.business_date,m.business_order,m.movement_id LIMIT ? OFFSET ?",
      [...params, query.limit + 1, query.offset],
    );
    const hasMore = seeds.length > query.limit;
    const items: PurchaseUnresolvedCostReportRow[] = [];

    for (const seed of seeds.slice(0, query.limit)) {
      const matchRows = await this.matches.listByReceiptLine(
        query.companyId,
        seed.receipt_document_id,
        seed.receipt_line_id,
      );
      const coverage = calculatePurchaseMatchingStatus(
        seed.quantity_delta,
        matchRows.map(item => item.matchedBaseQuantity),
      );
      let reason: PurchaseUnresolvedCostReportRow["reason"] | null =
        coverage.status === "unmatched"
          ? "awaiting-supplier-invoice"
          : coverage.status === "partially-matched"
            ? "partial-invoice-match"
            : null;

      if (reason === null) {
        for (const match of matchRows) {
          const invoice = await this.documents.findById(query.companyId, match.invoiceDocumentId);
          const fact = await this.commercialFacts.findByLine(query.companyId, match.invoiceDocumentId, match.invoiceLineId);
          if (!invoice || invoice.documentType !== "supplier-invoice" ||
              !["confirmed", "returned", "corrected"].includes(invoice.status) || !fact) {
            reason = "supplier-invoice-cost-unavailable";
            break;
          }
        }
      }
      if (reason === null) continue;

      items.push(Object.freeze({
        movementId: seed.movement_id,
        receiptDocumentId: seed.receipt_document_id,
        receiptDocumentNumber: seed.receipt_document_number,
        receiptLineId: seed.receipt_line_id,
        businessDate: seed.business_date,
        branchId: seed.branch_id,
        productId: seed.product_id,
        productCode: seed.product_code,
        productTitle: seed.product_title,
        warehouseId: seed.warehouse_id,
        warehouseCode: seed.warehouse_code,
        warehouseTitle: seed.warehouse_title,
        quantity: seed.quantity_delta,
        reason,
      }));
    }
    return Object.freeze({
      items: Object.freeze(items),
      nextOffset: hasMore ? query.offset + query.limit : null,
    });
  }
}
