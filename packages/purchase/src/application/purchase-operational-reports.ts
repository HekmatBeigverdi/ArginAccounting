import type { PurchaseCommercialFactSnapshot } from "./contracts/purchase-repository.ts";
import type { PurchaseDocumentSnapshot } from "../domain/purchase-document.ts";
import { calculatePurchaseDocumentTotals, calculatePurchaseLineTotals } from "../domain/purchase-pricing.ts";
import { normalizePurchaseQuantity } from "../domain/purchase-commercial-semantics.ts";

export const PURCHASE_OPERATIONAL_REPORT_LIMITS = Object.freeze({
  defaultLimit: 100,
  maxLimit: 500,
} as const);

export interface PurchaseOperationalReportQuery {
  readonly companyId: string;
  readonly branchId?: string | null;
  readonly fiscalYearId?: string | null;
  readonly supplierId?: string | null;
  readonly fromBusinessDate?: string | null;
  readonly toBusinessDate?: string | null;
  readonly limit?: number;
  readonly offset?: number;
}

export interface NormalizedPurchaseOperationalReportQuery {
  readonly companyId: string;
  readonly branchId: string | null;
  readonly fiscalYearId: string | null;
  readonly supplierId: string | null;
  readonly fromBusinessDate: string | null;
  readonly toBusinessDate: string | null;
  readonly limit: number;
  readonly offset: number;
}

export interface PurchaseDocumentRegisterRow {
  readonly documentId: string;
  readonly documentNumber: string | null;
  readonly documentType: PurchaseDocumentSnapshot["documentType"];
  readonly status: PurchaseDocumentSnapshot["status"];
  readonly businessDate: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly fiscalYearId: string;
  readonly supplierId: string;
  readonly supplierCode: string;
  readonly supplierDisplayName: string;
  readonly correctionReferenceDocumentId: string | null;
  readonly lineCount: number;
  readonly currency: string;
  readonly grossAmount: number;
  readonly discountAmount: number;
  readonly netAfterDiscount: number;
  readonly chargeAmount: number;
  readonly taxBaseAmount: number;
  readonly taxAmount: number;
  readonly grandTotal: number;
}

export interface PurchaseDocumentRegisterReport {
  readonly items: readonly PurchaseDocumentRegisterRow[];
  readonly nextOffset: number | null;
}

export interface PurchaseSupplierActivitySummaryRow {
  readonly supplierId: string;
  readonly supplierCode: string;
  readonly supplierDisplayName: string;
  readonly currency: string;
  readonly invoiceCount: number;
  readonly returnCount: number;
  readonly correctionCount: number;
  readonly invoiceGrandTotal: number;
  readonly returnGrandTotal: number;
  readonly correctionGrandTotal: number;
  /** Supplier invoices less confirmed return documents. Corrections are deliberately separate. */
  readonly netBeforeCorrections: number;
}

export interface PurchaseSupplierActivitySummaryReport {
  readonly items: readonly PurchaseSupplierActivitySummaryRow[];
}

export type PurchaseMatchingStatus = "unmatched" | "partially-matched" | "fully-matched";

export interface PurchaseMatchingQuantityStatus {
  readonly invoiceBaseQuantity: string;
  readonly matchedBaseQuantity: string;
  readonly remainingBaseQuantity: string;
  readonly status: PurchaseMatchingStatus;
}

export interface PurchaseInvoiceMatchingReportRow extends PurchaseMatchingQuantityStatus {
  readonly invoiceDocumentId: string;
  readonly invoiceDocumentNumber: string | null;
  readonly invoiceLineId: string;
  readonly businessDate: string;
  readonly branchId: string;
  readonly supplierId: string;
  readonly supplierCode: string;
  readonly supplierDisplayName: string;
  readonly productId: string;
  readonly productCode: string;
  readonly productDisplayName: string;
  readonly unitTitle: string;
}

export interface PurchaseInvoiceMatchingReport {
  readonly items: readonly PurchaseInvoiceMatchingReportRow[];
  readonly nextOffset: number | null;
}

export interface PurchaseUnresolvedCostReportRow {
  readonly movementId: string;
  readonly receiptDocumentId: string;
  readonly receiptDocumentNumber: string | null;
  readonly receiptLineId: string;
  readonly businessDate: string;
  readonly branchId: string | null;
  readonly productId: string;
  readonly productCode: string;
  readonly productTitle: string;
  readonly warehouseId: string;
  readonly warehouseCode: string;
  readonly warehouseTitle: string;
  readonly quantity: string;
  readonly reason: "cost-input-pending" | "invoice-match-required" | "awaiting-supplier-invoice" | "partial-invoice-match" | "supplier-invoice-cost-unavailable";
}

export interface PurchaseUnresolvedCostReport {
  readonly items: readonly PurchaseUnresolvedCostReportRow[];
  readonly nextOffset: number | null;
}

export interface PurchaseOperationalReportReader {
  readDocumentRegister(query: PurchaseOperationalReportQuery): Promise<PurchaseDocumentRegisterReport>;
  readSupplierActivity(query: PurchaseOperationalReportQuery): Promise<PurchaseSupplierActivitySummaryReport>;
  readInvoiceMatching(query: PurchaseOperationalReportQuery): Promise<PurchaseInvoiceMatchingReport>;
  readUnresolvedCosts(query: PurchaseOperationalReportQuery): Promise<PurchaseUnresolvedCostReport>;
}

const required = (value: string, field: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new TypeError("purchase.report_input_invalid:" + field);
  return value.trim();
};

const optional = (value: string | null | undefined): string | null => {
  if (value == null) return null;
  const normalized = value.trim();
  return normalized || null;
};

const date = (value: string | null | undefined, field: string): string | null => {
  if (value == null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new TypeError("purchase.report_input_invalid:" + field);
  const parsed = new Date(value + "T00:00:00.000Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new TypeError("purchase.report_input_invalid:" + field);
  }
  return value;
};

export function normalizePurchaseOperationalReportQuery(
  input: PurchaseOperationalReportQuery,
): NormalizedPurchaseOperationalReportQuery {
  const limit = input.limit ?? PURCHASE_OPERATIONAL_REPORT_LIMITS.defaultLimit;
  const offset = input.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > PURCHASE_OPERATIONAL_REPORT_LIMITS.maxLimit) {
    throw new TypeError("purchase.report_input_invalid:limit");
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new TypeError("purchase.report_input_invalid:offset");
  }
  const fromBusinessDate = date(input.fromBusinessDate, "fromBusinessDate");
  const toBusinessDate = date(input.toBusinessDate, "toBusinessDate");
  if (fromBusinessDate && toBusinessDate && fromBusinessDate > toBusinessDate) {
    throw new TypeError("purchase.report_input_invalid:businessDateRange");
  }
  return Object.freeze({
    companyId: required(input.companyId, "companyId"),
    branchId: optional(input.branchId),
    fiscalYearId: optional(input.fiscalYearId),
    supplierId: optional(input.supplierId),
    fromBusinessDate,
    toBusinessDate,
    limit,
    offset,
  });
}

export function buildPurchaseDocumentRegisterRow(
  document: PurchaseDocumentSnapshot,
  commercialFacts: readonly PurchaseCommercialFactSnapshot[],
): PurchaseDocumentRegisterRow {
  const byLine = new Map(commercialFacts.map(fact => [fact.purchaseLineId, fact]));
  const totals = document.lines.map(line => {
    const fact = byLine.get(line.lineId);
    if (!fact || fact.companyId !== document.companyId || fact.purchaseDocumentId !== document.documentId) {
      throw new TypeError("purchase.report_dependency_invalid:commercialFact:" + line.lineId);
    }
    return calculatePurchaseLineTotals(fact.commercialTerms);
  });
  const documentTotals = calculatePurchaseDocumentTotals(totals);
  return Object.freeze({
    documentId: document.documentId,
    documentNumber: document.documentNumber,
    documentType: document.documentType,
    status: document.status,
    businessDate: document.businessDate,
    companyId: document.companyId,
    branchId: document.scope.branchId,
    fiscalYearId: document.scope.fiscalYearId,
    supplierId: document.supplierId,
    supplierCode: document.supplierSnapshot.code,
    supplierDisplayName: document.supplierSnapshot.displayName,
    correctionReferenceDocumentId: document.correctionReference?.documentId ?? null,
    lineCount: documentTotals.lineCount,
    currency: documentTotals.currency,
    grossAmount: documentTotals.grossAmount,
    discountAmount: documentTotals.discountAmount,
    netAfterDiscount: documentTotals.netAfterDiscount,
    chargeAmount: documentTotals.chargeAmount,
    taxBaseAmount: documentTotals.taxBaseAmount,
    taxAmount: documentTotals.taxAmount,
    grandTotal: documentTotals.grandTotal,
  });
}

const safeAdd = (left: number, right: number, field: string): number => {
  const result = BigInt(left) + BigInt(right);
  if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new TypeError("purchase.report_amount_overflow:" + field);
  }
  return Number(result);
};

export function buildPurchaseSupplierActivitySummary(
  rows: readonly PurchaseDocumentRegisterRow[],
): readonly PurchaseSupplierActivitySummaryRow[] {
  const map = new Map<string, {
    supplierId: string;
    supplierCode: string;
    supplierDisplayName: string;
    currency: string;
    invoiceCount: number;
    returnCount: number;
    correctionCount: number;
    invoiceGrandTotal: number;
    returnGrandTotal: number;
    correctionGrandTotal: number;
  }>();

  for (const row of rows) {
    const isOperational =
      row.documentType === "supplier-invoice"
        ? ["confirmed", "returned", "corrected"].includes(row.status)
        : row.status === "confirmed";
    if (!isOperational || !row.currency) continue;

    const key = row.supplierId + "\u0000" + row.currency;
    const current = map.get(key) ?? {
      supplierId: row.supplierId,
      supplierCode: row.supplierCode,
      supplierDisplayName: row.supplierDisplayName,
      currency: row.currency,
      invoiceCount: 0,
      returnCount: 0,
      correctionCount: 0,
      invoiceGrandTotal: 0,
      returnGrandTotal: 0,
      correctionGrandTotal: 0,
    };

    if (row.documentType === "supplier-invoice") {
      current.invoiceCount += 1;
      current.invoiceGrandTotal = safeAdd(current.invoiceGrandTotal, row.grandTotal, "invoiceGrandTotal");
    } else if (row.documentType === "purchase-return") {
      current.returnCount += 1;
      current.returnGrandTotal = safeAdd(current.returnGrandTotal, row.grandTotal, "returnGrandTotal");
    } else if (row.documentType === "purchase-correction") {
      current.correctionCount += 1;
      current.correctionGrandTotal = safeAdd(current.correctionGrandTotal, row.grandTotal, "correctionGrandTotal");
    }
    map.set(key, current);
  }

  return Object.freeze(
    [...map.values()]
      .map(value => Object.freeze({
        ...value,
        netBeforeCorrections: value.invoiceGrandTotal - value.returnGrandTotal,
      }))
      .sort((left, right) =>
        left.supplierDisplayName.localeCompare(right.supplierDisplayName, "fa") ||
        left.currency.localeCompare(right.currency),
      ),
  );
}

type Decimal = Readonly<{ coefficient: bigint; scale: number }>;

function parseDecimal(value: string, field: string): Decimal {
  const canonical = normalizePurchaseQuantity(value);
  const [whole = "0", fraction = ""] = canonical.split(".");
  const coefficient = BigInt(whole + fraction);
  if (coefficient < 0n) throw new TypeError("purchase.report_input_invalid:" + field);
  return Object.freeze({ coefficient, scale: fraction.length });
}

const pow10 = (scale: number): bigint => 10n ** BigInt(scale);

function addDecimal(left: Decimal, right: Decimal): Decimal {
  const scale = Math.max(left.scale, right.scale);
  return Object.freeze({
    coefficient:
      left.coefficient * pow10(scale - left.scale) +
      right.coefficient * pow10(scale - right.scale),
    scale,
  });
}

function compareDecimal(left: Decimal, right: Decimal): number {
  const scale = Math.max(left.scale, right.scale);
  const a = left.coefficient * pow10(scale - left.scale);
  const b = right.coefficient * pow10(scale - right.scale);
  return a === b ? 0 : a < b ? -1 : 1;
}

function subtractDecimal(left: Decimal, right: Decimal): Decimal {
  const scale = Math.max(left.scale, right.scale);
  return Object.freeze({
    coefficient:
      left.coefficient * pow10(scale - left.scale) -
      right.coefficient * pow10(scale - right.scale),
    scale,
  });
}

function formatDecimal(value: Decimal): string {
  if (value.coefficient < 0n) throw new TypeError("purchase.report_input_invalid:negativeQuantity");
  if (value.scale === 0) return value.coefficient.toString();
  const digits = value.coefficient.toString().padStart(value.scale + 1, "0");
  const raw = digits.slice(0, -value.scale) + "." + digits.slice(-value.scale);
  return raw.replace(/\.0+$/u, "").replace(/(\.\d*?)0+$/u, "$1");
}

export function calculatePurchaseMatchingStatus(
  invoiceBaseQuantity: string,
  matchedBaseQuantities: readonly string[],
): PurchaseMatchingQuantityStatus {
  const invoice = parseDecimal(invoiceBaseQuantity, "invoiceBaseQuantity");
  let matched: Decimal = Object.freeze({ coefficient: 0n, scale: 0 });
  for (const value of matchedBaseQuantities) {
    matched = addDecimal(matched, parseDecimal(value, "matchedBaseQuantity"));
  }
  const comparison = compareDecimal(matched, invoice);
  if (comparison > 0) throw new TypeError("purchase.report_dependency_invalid:overmatched");
  const remaining = subtractDecimal(invoice, matched);
  const status: PurchaseMatchingStatus =
    matched.coefficient === 0n
      ? "unmatched"
      : comparison === 0
        ? "fully-matched"
        : "partially-matched";
  return Object.freeze({
    invoiceBaseQuantity: formatDecimal(invoice),
    matchedBaseQuantity: formatDecimal(matched),
    remainingBaseQuantity: formatDecimal(remaining),
    status,
  });
}
