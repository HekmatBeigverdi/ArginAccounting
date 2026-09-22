import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
} from "./purchase-posting-domain-errors.ts";
import type { PurchasePostingDomainErrorCode } from "./purchase-posting-domain-errors.ts";

export const PURCHASE_POSTING_SOURCE_DOCUMENT_TYPES = Object.freeze([
  "purchase-order",
  "supplier-invoice",
  "purchase-return",
  "purchase-correction",
] as const);

export type PurchasePostingSourceDocumentType =
  (typeof PURCHASE_POSTING_SOURCE_DOCUMENT_TYPES)[number];

export const PURCHASE_POSTING_SOURCE_STATUSES = Object.freeze([
  "confirmed",
  "returned",
  "corrected",
] as const);

export type PurchasePostingSourceStatus =
  (typeof PURCHASE_POSTING_SOURCE_STATUSES)[number];

export const PURCHASE_POSTING_LINE_KINDS = Object.freeze([
  "stock-product",
  "non-stock-product",
  "service",
] as const);

export type PurchasePostingLineKind =
  (typeof PURCHASE_POSTING_LINE_KINDS)[number];

export type PurchasePostingItemType = "product" | "service";
export type PurchasePostingValuationMethod = "fifo" | "moving_average";

export interface PurchasePostingMoneySnapshot {
  readonly amount: number;
  readonly currency: string;
}

export interface PurchasePostingCommercialAmountsSnapshot {
  readonly currency: string;
  readonly grossAmount: number;
  readonly discountAmount: number;
  readonly netAfterDiscount: number;
  readonly chargeAmount: number;
  readonly taxBaseAmount: number;
  readonly taxAmount: number;
  readonly grandTotal: number;
}

export interface PurchasePostingSupplierSnapshot {
  readonly supplierId: string;
  readonly code: string;
  readonly displayName: string;
  readonly nationalCode: string | null;
  readonly nationalId: string | null;
  readonly economicNumber: string | null;
  readonly taxFileNumber: string | null;
}

export interface PurchasePostingItemSnapshot {
  readonly itemId: string;
  readonly itemType: PurchasePostingItemType;
  readonly code: string;
  readonly displayName: string;
  readonly taxpayerGoodsServiceId: string | null;
  readonly stockTracking: boolean;
}

export interface PurchasePostingValuationSnapshot {
  readonly valuationEntryId: string;
  readonly movementId: string;
  readonly receiptDocumentId: string;
  readonly receiptLineId: string;
  readonly productId: string;
  readonly warehouseId: string;
  readonly policyId: string;
  readonly method: PurchasePostingValuationMethod;
  readonly strategyVersion: number;
  readonly currency: string;
  readonly quantity: string;
  readonly unitCost: string;
  readonly totalCost: number;
}

export interface PurchasePostingLineFactSnapshot {
  readonly purchaseLineId: string;
  readonly position: number;
  readonly lineKind: PurchasePostingLineKind;
  readonly item: PurchasePostingItemSnapshot;
  readonly baseQuantity: string;
  readonly amounts: PurchasePostingCommercialAmountsSnapshot;
  readonly valuation: PurchasePostingValuationSnapshot | null;
}

export interface PurchasePostingFactSnapshot {
  readonly factId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly fiscalYearId: string;
  readonly fiscalPeriodId: string;
  readonly purchaseDocumentId: string;
  readonly purchaseDocumentVersion: number;
  readonly documentType: PurchasePostingSourceDocumentType;
  readonly sourceStatus: PurchasePostingSourceStatus;
  readonly documentNumber: string | null;
  readonly businessDate: string;
  readonly supplier: PurchasePostingSupplierSnapshot;
  readonly lines: readonly PurchasePostingLineFactSnapshot[];
  readonly totals: PurchasePostingCommercialAmountsSnapshot;
  readonly capturedAt: string;
}

export interface CreatePurchasePostingFactInput {
  readonly factId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly fiscalYearId: string;
  readonly fiscalPeriodId: string;
  readonly purchaseDocumentId: string;
  readonly purchaseDocumentVersion: number;
  readonly documentType: PurchasePostingSourceDocumentType;
  readonly sourceStatus: PurchasePostingSourceStatus;
  readonly documentNumber?: string | null;
  readonly businessDate: string;
  readonly supplier: PurchasePostingSupplierSnapshot;
  readonly lines: readonly PurchasePostingLineFactSnapshot[];
  readonly totals: PurchasePostingCommercialAmountsSnapshot;
  readonly capturedAt: string;
}

const fail = (code: PurchasePostingDomainErrorCode, field: string): never => {
  throw new PurchasePostingDomainError(code, field);
};

function assertObject(value: unknown, field: string): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.snapshotInvalid, field);
  }
}

function required(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.identityRequired, field);
  }
  return value.trim();
}

function optionalText(value: string | null | undefined, field: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.snapshotInvalid, field);
  }
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function timestamp(value: string, field: string): string {
  if (typeof value !== "string") {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.timestampInvalid, field);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.timestampInvalid, field);
  }
  return value;
}

function businessDate(value: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.snapshotInvalid, "businessDate");
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.snapshotInvalid, "businessDate");
  }
  return value;
}

function currency(value: string, field: string): string {
  if (typeof value !== "string") {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.currencyInvalid, field);
  }
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/u.test(normalized)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.currencyInvalid, field);
  }
  return normalized;
}

function nonNegativeMoney(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.moneyInvalid, field);
  }
  return value;
}

function signedMoney(value: number, field: string): number {
  if (!Number.isSafeInteger(value)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.moneyInvalid, field);
  }
  return value;
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.versionInvalid, field);
  }
  return value;
}

function quantity(value: string, field: string): string {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/u.test(value.trim())) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.quantityInvalid, field);
  }
  const normalized = value.trim().replace(/^0+(?=\d)/u, "").replace(/\.0+$/u, "").replace(/(\.\d*?)0+$/u, "$1");
  if (Number(normalized) <= 0) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.quantityInvalid, field);
  }
  return normalized;
}

function unitCost(value: string, field: string): string {
  if (typeof value !== "string" || !/^-?\d+(?:\.\d+)?$/u.test(value.trim())) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.valuationInvalid, field);
  }
  return value.trim();
}

export function createPurchasePostingCommercialAmountsSnapshot(
  input: PurchasePostingCommercialAmountsSnapshot,
  field = "amounts",
): PurchasePostingCommercialAmountsSnapshot {
  assertObject(input, field);
  const normalized = Object.freeze({
    currency: currency(input.currency, `${field}.currency`),
    grossAmount: nonNegativeMoney(input.grossAmount, `${field}.grossAmount`),
    discountAmount: nonNegativeMoney(input.discountAmount, `${field}.discountAmount`),
    netAfterDiscount: nonNegativeMoney(input.netAfterDiscount, `${field}.netAfterDiscount`),
    chargeAmount: nonNegativeMoney(input.chargeAmount, `${field}.chargeAmount`),
    taxBaseAmount: nonNegativeMoney(input.taxBaseAmount, `${field}.taxBaseAmount`),
    taxAmount: nonNegativeMoney(input.taxAmount, `${field}.taxAmount`),
    grandTotal: nonNegativeMoney(input.grandTotal, `${field}.grandTotal`),
  });
  if (normalized.grossAmount - normalized.discountAmount !== normalized.netAfterDiscount) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.amountMismatch, `${field}.netAfterDiscount`);
  }
  if (normalized.netAfterDiscount + normalized.chargeAmount !== normalized.taxBaseAmount) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.amountMismatch, `${field}.taxBaseAmount`);
  }
  if (normalized.taxBaseAmount + normalized.taxAmount !== normalized.grandTotal) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.amountMismatch, `${field}.grandTotal`);
  }
  return normalized;
}

export function createPurchasePostingSupplierSnapshot(
  input: PurchasePostingSupplierSnapshot,
): PurchasePostingSupplierSnapshot {
  assertObject(input, "supplier");
  return Object.freeze({
    supplierId: required(input.supplierId, "supplier.supplierId"),
    code: required(input.code, "supplier.code"),
    displayName: required(input.displayName, "supplier.displayName"),
    nationalCode: optionalText(input.nationalCode, "supplier.nationalCode"),
    nationalId: optionalText(input.nationalId, "supplier.nationalId"),
    economicNumber: optionalText(input.economicNumber, "supplier.economicNumber"),
    taxFileNumber: optionalText(input.taxFileNumber, "supplier.taxFileNumber"),
  });
}

export function createPurchasePostingItemSnapshot(
  input: PurchasePostingItemSnapshot,
): PurchasePostingItemSnapshot {
  assertObject(input, "item");
  if (input.itemType !== "product" && input.itemType !== "service") {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.snapshotInvalid, "item.itemType");
  }
  if (typeof input.stockTracking !== "boolean") {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.snapshotInvalid, "item.stockTracking");
  }
  if (input.itemType === "service" && input.stockTracking) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.snapshotInvalid, "item.stockTracking");
  }
  const taxpayerGoodsServiceId = optionalText(input.taxpayerGoodsServiceId, "item.taxpayerGoodsServiceId");
  if (taxpayerGoodsServiceId !== null && !/^\d{13}$/u.test(taxpayerGoodsServiceId)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.snapshotInvalid, "item.taxpayerGoodsServiceId");
  }
  return Object.freeze({
    itemId: required(input.itemId, "item.itemId"),
    itemType: input.itemType,
    code: required(input.code, "item.code"),
    displayName: required(input.displayName, "item.displayName"),
    taxpayerGoodsServiceId,
    stockTracking: input.stockTracking,
  });
}

export function createPurchasePostingValuationSnapshot(
  input: PurchasePostingValuationSnapshot,
): PurchasePostingValuationSnapshot {
  assertObject(input, "valuation");
  if (input.method !== "fifo" && input.method !== "moving_average") {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.valuationInvalid, "valuation.method");
  }
  return Object.freeze({
    valuationEntryId: required(input.valuationEntryId, "valuation.valuationEntryId"),
    movementId: required(input.movementId, "valuation.movementId"),
    receiptDocumentId: required(input.receiptDocumentId, "valuation.receiptDocumentId"),
    receiptLineId: required(input.receiptLineId, "valuation.receiptLineId"),
    productId: required(input.productId, "valuation.productId"),
    warehouseId: required(input.warehouseId, "valuation.warehouseId"),
    policyId: required(input.policyId, "valuation.policyId"),
    method: input.method,
    strategyVersion: positiveInteger(input.strategyVersion, "valuation.strategyVersion"),
    currency: currency(input.currency, "valuation.currency"),
    quantity: quantity(input.quantity, "valuation.quantity"),
    unitCost: unitCost(input.unitCost, "valuation.unitCost"),
    totalCost: signedMoney(input.totalCost, "valuation.totalCost"),
  });
}

export function createPurchasePostingLineFactSnapshot(
  input: PurchasePostingLineFactSnapshot,
): PurchasePostingLineFactSnapshot {
  assertObject(input, "line");
  if (!PURCHASE_POSTING_LINE_KINDS.includes(input.lineKind)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.snapshotInvalid, "line.lineKind");
  }
  if (!Number.isSafeInteger(input.position) || input.position < 1) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.snapshotInvalid, "line.position");
  }
  const item = createPurchasePostingItemSnapshot(input.item);
  if (input.lineKind === "service" && item.itemType !== "service") {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.snapshotInvalid, "line.item.itemType");
  }
  if (input.lineKind !== "service" && item.itemType !== "product") {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.snapshotInvalid, "line.item.itemType");
  }
  if (input.lineKind === "stock-product" && !item.stockTracking) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.snapshotInvalid, "line.item.stockTracking");
  }
  if (input.lineKind !== "stock-product" && item.stockTracking) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.snapshotInvalid, "line.item.stockTracking");
  }
  const valuation = input.valuation === null ? null : createPurchasePostingValuationSnapshot(input.valuation);
  if (valuation !== null) {
    if (input.lineKind !== "stock-product") {
      return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.valuationInvalid, "line.valuation");
    }
    if (valuation.productId !== item.itemId) {
      return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.valuationInvalid, "line.valuation.productId");
    }
  }
  return Object.freeze({
    purchaseLineId: required(input.purchaseLineId, "line.purchaseLineId"),
    position: input.position,
    lineKind: input.lineKind,
    item,
    baseQuantity: quantity(input.baseQuantity, "line.baseQuantity"),
    amounts: createPurchasePostingCommercialAmountsSnapshot(input.amounts, "line.amounts"),
    valuation,
  });
}

function sumLineAmounts(
  lines: readonly PurchasePostingLineFactSnapshot[],
): PurchasePostingCommercialAmountsSnapshot {
  if (lines.length === 0) {
    return Object.freeze({
      currency: "",
      grossAmount: 0,
      discountAmount: 0,
      netAfterDiscount: 0,
      chargeAmount: 0,
      taxBaseAmount: 0,
      taxAmount: 0,
      grandTotal: 0,
    });
  }
  const expectedCurrency = lines[0]!.amounts.currency;
  const result = {
    currency: expectedCurrency,
    grossAmount: 0,
    discountAmount: 0,
    netAfterDiscount: 0,
    chargeAmount: 0,
    taxBaseAmount: 0,
    taxAmount: 0,
    grandTotal: 0,
  };
  for (const line of lines) {
    if (line.amounts.currency !== expectedCurrency) {
      return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.currencyInvalid, "lines.amounts.currency");
    }
    for (const key of [
      "grossAmount",
      "discountAmount",
      "netAfterDiscount",
      "chargeAmount",
      "taxBaseAmount",
      "taxAmount",
      "grandTotal",
    ] as const) {
      const next = result[key] + line.amounts[key];
      if (!Number.isSafeInteger(next)) {
        return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.moneyInvalid, `totals.${key}`);
      }
      result[key] = next;
    }
  }
  return Object.freeze(result);
}

export function createPurchasePostingFact(
  input: CreatePurchasePostingFactInput,
): PurchasePostingFactSnapshot {
  assertObject(input, "fact");
  if (!PURCHASE_POSTING_SOURCE_DOCUMENT_TYPES.includes(input.documentType)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.documentTypeInvalid, "documentType");
  }
  if (!PURCHASE_POSTING_SOURCE_STATUSES.includes(input.sourceStatus)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.sourceStatusInvalid, "sourceStatus");
  }
  if (!Array.isArray(input.lines)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.snapshotInvalid, "lines");
  }

  const lineIds = new Set<string>();
  const positions = new Set<number>();
  const lines = input.lines.map((raw, index) => {
    const line = createPurchasePostingLineFactSnapshot(raw);
    if (lineIds.has(line.purchaseLineId)) {
      return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.duplicateLineId, `lines[${index}].purchaseLineId`);
    }
    if (positions.has(line.position)) {
      return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.duplicateLinePosition, `lines[${index}].position`);
    }
    lineIds.add(line.purchaseLineId);
    positions.add(line.position);
    return line;
  }).sort((a, b) => a.position - b.position);

  const totals = createPurchasePostingCommercialAmountsSnapshot(input.totals, "totals");
  const summed = sumLineAmounts(lines);
  if (lines.length > 0) {
    if (summed.currency !== totals.currency) {
      return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.currencyInvalid, "totals.currency");
    }
    for (const key of [
      "grossAmount",
      "discountAmount",
      "netAfterDiscount",
      "chargeAmount",
      "taxBaseAmount",
      "taxAmount",
      "grandTotal",
    ] as const) {
      if (summed[key] !== totals[key]) {
        return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.amountMismatch, `totals.${key}`);
      }
    }
  }

  return Object.freeze({
    factId: required(input.factId, "factId"),
    companyId: required(input.companyId, "companyId"),
    branchId: required(input.branchId, "branchId"),
    fiscalYearId: required(input.fiscalYearId, "fiscalYearId"),
    fiscalPeriodId: required(input.fiscalPeriodId, "fiscalPeriodId"),
    purchaseDocumentId: required(input.purchaseDocumentId, "purchaseDocumentId"),
    purchaseDocumentVersion: positiveInteger(input.purchaseDocumentVersion, "purchaseDocumentVersion"),
    documentType: input.documentType,
    sourceStatus: input.sourceStatus,
    documentNumber: optionalText(input.documentNumber, "documentNumber"),
    businessDate: businessDate(input.businessDate),
    supplier: createPurchasePostingSupplierSnapshot(input.supplier),
    lines: Object.freeze(lines),
    totals,
    capturedAt: timestamp(input.capturedAt, "capturedAt"),
  });
}
