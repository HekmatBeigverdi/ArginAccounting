import {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
} from "./purchase-domain-errors.ts";
import type { PurchaseDomainErrorCode } from "./purchase-domain-errors.ts";

export interface PurchaseCompensationDocumentReference {
  readonly documentId: string;
  readonly documentType: "supplier-invoice" | "purchase-return" | "purchase-correction" | string;
  readonly status: "confirmed" | string;
  readonly companyId: string;
  readonly supplierId: string;
  readonly correctionReference?: {
    readonly documentId: string;
    readonly reason: string;
  } | null;
}

export interface PurchaseReturnLineInput {
  readonly originalLineId: string;
  readonly returnLineId: string;
  readonly productId: string;
  readonly returnedBaseQuantity: string;
  readonly originalBaseQuantity: string;
  readonly warehouseId: string;
}

export interface PurchaseReturnInventoryLine {
  readonly originalLineId: string;
  readonly sourceLineId: string;
  readonly productId: string;
  readonly quantity: string;
  readonly warehouseId: string;
}

export interface PurchaseReturnWorkflowPlan {
  readonly kind: "purchase-return";
  readonly originalDocumentId: string;
  readonly returnDocumentId: string;
  readonly inventoryEffect: {
    readonly kind: "outbound-compensation";
    readonly sourceDocumentId: string;
    readonly originalDocumentId: string;
    readonly lines: readonly PurchaseReturnInventoryLine[];
  };
  readonly rewritesOriginalDocument: false;
  readonly rewritesOriginalCostInput: false;
  readonly requiresCostBasisRecalculation: false;
}

export type PurchaseCorrectionEffect =
  | "commercial-replacement"
  | "quantity-decrease"
  | "quantity-increase";

export interface PurchaseCorrectionLineInput {
  readonly originalLineId: string;
  readonly correctionLineId: string;
  readonly productId: string;
  readonly effect: PurchaseCorrectionEffect;
  readonly originalBaseQuantity?: string;
  readonly correctedBaseQuantity?: string;
  readonly warehouseId?: string;
  readonly affectedMovementIds?: readonly string[];
}

export interface PurchaseCorrectionInventoryEffect {
  readonly kind: "outbound-compensation" | "inbound-follow-up";
  readonly originalLineId: string;
  readonly sourceLineId: string;
  readonly productId: string;
  readonly quantity: string;
  readonly warehouseId: string;
}

export interface PurchaseCorrectionWorkflowPlan {
  readonly kind: "purchase-correction";
  readonly originalDocumentId: string;
  readonly correctionDocumentId: string;
  readonly rewritesOriginalDocument: false;
  readonly replacesAuthoritativeCostInput: boolean;
  readonly requiresCostBasisRecalculation: boolean;
  readonly recalculationReason: "cost_basis_changed" | null;
  readonly affectedMovementIds: readonly string[];
  readonly inventoryEffects: readonly PurchaseCorrectionInventoryEffect[];
}

type Decimal = { readonly coefficient: bigint; readonly scale: number };

const fail = (code: PurchaseDomainErrorCode, field: string): never => {
  throw new PurchaseDomainError(code, field);
};

function required(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.identityRequired, field);
  }
  return value.trim();
}

function parsePositiveQuantity(value: string, field: string): Decimal {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/u.test(value.trim())) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.purchaseCompensationQuantityInvalid, field);
  }
  const [wholeRaw = "", fractionRaw = ""] = value.trim().split(".");
  const whole = wholeRaw.replace(/^0+(?=\d)/u, "");
  const fraction = fractionRaw.replace(/0+$/u, "");
  if (whole.length > 36 || fraction.length > 18) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.purchaseCompensationQuantityInvalid, field);
  }
  const coefficient = BigInt(whole + fraction);
  if (coefficient <= 0n) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.purchaseCompensationQuantityInvalid, field);
  }
  return { coefficient, scale: fraction.length };
}

function power(scale: number): bigint {
  return 10n ** BigInt(scale);
}

function compare(left: Decimal, right: Decimal): number {
  const scale = Math.max(left.scale, right.scale);
  const a = left.coefficient * power(scale - left.scale);
  const b = right.coefficient * power(scale - right.scale);
  return a === b ? 0 : a < b ? -1 : 1;
}

function subtract(left: Decimal, right: Decimal, field: string): string {
  const scale = Math.max(left.scale, right.scale);
  const value = left.coefficient * power(scale - left.scale) - right.coefficient * power(scale - right.scale);
  if (value <= 0n) return fail(PURCHASE_DOMAIN_ERROR_CODES.purchaseCompensationQuantityInvalid, field);
  const digits = value.toString().padStart(scale + 1, "0");
  if (scale === 0) return digits;
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`
    .replace(/\.0+$/u, "")
    .replace(/(\.\d*?)0+$/u, "$1");
}

function validateOriginal(document: PurchaseCompensationDocumentReference): void {
  if (!document || typeof document !== "object") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.purchaseCompensationInvalid, "originalDocument");
  }
  if (document.documentType !== "supplier-invoice" || document.status !== "confirmed") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.purchaseCompensationIneligible, "originalDocument");
  }
  required(document.documentId, "originalDocument.documentId");
  required(document.companyId, "originalDocument.companyId");
  required(document.supplierId, "originalDocument.supplierId");
}

function validateCompensating(
  original: PurchaseCompensationDocumentReference,
  document: PurchaseCompensationDocumentReference,
  expectedType: "purchase-return" | "purchase-correction",
  field: "returnDocument" | "correctionDocument",
): void {
  if (!document || typeof document !== "object") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.purchaseCompensationInvalid, field);
  }
  if (document.documentType !== expectedType || document.status !== "confirmed") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.purchaseCompensationIneligible, field);
  }
  const documentId = required(document.documentId, `${field}.documentId`);
  if (documentId === original.documentId) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.purchaseCompensationReferenceInvalid, `${field}.documentId`);
  }
  if (document.companyId !== original.companyId) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.purchaseCompensationReferenceInvalid, `${field}.companyId`);
  }
  if (document.supplierId !== original.supplierId) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.purchaseCompensationReferenceInvalid, `${field}.supplierId`);
  }
  if (!document.correctionReference || document.correctionReference.documentId !== original.documentId) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.purchaseCompensationReferenceInvalid, `${field}.correctionReference.documentId`);
  }
  required(document.correctionReference.reason, `${field}.correctionReference.reason`);
}

function uniqueIds(values: readonly string[], field: string): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = required(raw, field);
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  result.sort();
  return Object.freeze(result);
}

export function createPurchaseReturnWorkflowPlan(input: {
  readonly originalDocument: PurchaseCompensationDocumentReference;
  readonly returnDocument: PurchaseCompensationDocumentReference;
  readonly lines: readonly PurchaseReturnLineInput[];
}): PurchaseReturnWorkflowPlan {
  if (!input || typeof input !== "object" || !Array.isArray(input.lines) || input.lines.length === 0) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.purchaseCompensationInvalid, "input");
  }
  validateOriginal(input.originalDocument);
  validateCompensating(input.originalDocument, input.returnDocument, "purchase-return", "returnDocument");

  const originalLineIds = new Set<string>();
  const returnLineIds = new Set<string>();
  const lines: PurchaseReturnInventoryLine[] = [];
  for (let index = 0; index < input.lines.length; index += 1) {
    const line = input.lines[index]!;
    const originalLineId = required(line.originalLineId, `lines[${index}].originalLineId`);
    const returnLineId = required(line.returnLineId, `lines[${index}].returnLineId`);
    if (originalLineIds.has(originalLineId) || returnLineIds.has(returnLineId)) {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.purchaseCompensationDuplicateLine, `lines[${index}]`);
    }
    originalLineIds.add(originalLineId);
    returnLineIds.add(returnLineId);
    const returned = parsePositiveQuantity(line.returnedBaseQuantity, `lines[${index}].returnedBaseQuantity`);
    const original = parsePositiveQuantity(line.originalBaseQuantity, `lines[${index}].originalBaseQuantity`);
    if (compare(returned, original) > 0) {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.purchaseCompensationQuantityInvalid, `lines[${index}].returnedBaseQuantity`);
    }
    lines.push(Object.freeze({
      originalLineId,
      sourceLineId: returnLineId,
      productId: required(line.productId, `lines[${index}].productId`),
      quantity: line.returnedBaseQuantity.trim().replace(/^0+(?=\d)/u, "").replace(/\.0+$/u, ""),
      warehouseId: required(line.warehouseId, `lines[${index}].warehouseId`),
    }));
  }

  return Object.freeze({
    kind: "purchase-return",
    originalDocumentId: input.originalDocument.documentId,
    returnDocumentId: input.returnDocument.documentId,
    inventoryEffect: Object.freeze({
      kind: "outbound-compensation",
      sourceDocumentId: input.returnDocument.documentId,
      originalDocumentId: input.originalDocument.documentId,
      lines: Object.freeze(lines),
    }),
    rewritesOriginalDocument: false,
    rewritesOriginalCostInput: false,
    requiresCostBasisRecalculation: false,
  });
}

export function createPurchaseCorrectionWorkflowPlan(input: {
  readonly originalDocument: PurchaseCompensationDocumentReference;
  readonly correctionDocument: PurchaseCompensationDocumentReference;
  readonly lines: readonly PurchaseCorrectionLineInput[];
}): PurchaseCorrectionWorkflowPlan {
  if (!input || typeof input !== "object" || !Array.isArray(input.lines)) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.purchaseCompensationInvalid, "input");
  }
  validateOriginal(input.originalDocument);
  validateCompensating(input.originalDocument, input.correctionDocument, "purchase-correction", "correctionDocument");

  const originalLineIds = new Set<string>();
  const correctionLineIds = new Set<string>();
  const inventoryEffects: PurchaseCorrectionInventoryEffect[] = [];
  const movementIds: string[] = [];

  for (let index = 0; index < input.lines.length; index += 1) {
    const line = input.lines[index]!;
    const originalLineId = required(line.originalLineId, `lines[${index}].originalLineId`);
    const correctionLineId = required(line.correctionLineId, `lines[${index}].correctionLineId`);
    if (originalLineIds.has(originalLineId) || correctionLineIds.has(correctionLineId)) {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.purchaseCompensationDuplicateLine, `lines[${index}]`);
    }
    originalLineIds.add(originalLineId);
    correctionLineIds.add(correctionLineId);
    const productId = required(line.productId, `lines[${index}].productId`);
    const affected = uniqueIds(line.affectedMovementIds ?? [], `lines[${index}].affectedMovementIds`);
    movementIds.push(...affected);

    if (line.effect === "commercial-replacement") continue;
    if (line.effect !== "quantity-decrease" && line.effect !== "quantity-increase") {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.purchaseCompensationInvalid, `lines[${index}].effect`);
    }
    const originalQuantity = parsePositiveQuantity(line.originalBaseQuantity ?? "", `lines[${index}].originalBaseQuantity`);
    const correctedQuantity = parsePositiveQuantity(line.correctedBaseQuantity ?? "", `lines[${index}].correctedBaseQuantity`);
    const comparison = compare(correctedQuantity, originalQuantity);
    if ((line.effect === "quantity-decrease" && comparison >= 0) ||
        (line.effect === "quantity-increase" && comparison <= 0)) {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.purchaseCompensationQuantityInvalid, `lines[${index}].correctedBaseQuantity`);
    }
    const quantity = line.effect === "quantity-decrease"
      ? subtract(originalQuantity, correctedQuantity, `lines[${index}].correctedBaseQuantity`)
      : subtract(correctedQuantity, originalQuantity, `lines[${index}].correctedBaseQuantity`);
    inventoryEffects.push(Object.freeze({
      kind: line.effect === "quantity-decrease" ? "outbound-compensation" : "inbound-follow-up",
      originalLineId,
      sourceLineId: correctionLineId,
      productId,
      quantity,
      warehouseId: required(line.warehouseId ?? "", `lines[${index}].warehouseId`),
    }));
  }

  const affectedMovementIds = uniqueIds(movementIds, "affectedMovementIds");
  const requiresCostBasisRecalculation = affectedMovementIds.length > 0;
  return Object.freeze({
    kind: "purchase-correction",
    originalDocumentId: input.originalDocument.documentId,
    correctionDocumentId: input.correctionDocument.documentId,
    rewritesOriginalDocument: false,
    replacesAuthoritativeCostInput: requiresCostBasisRecalculation,
    requiresCostBasisRecalculation,
    recalculationReason: requiresCostBasisRecalculation ? "cost_basis_changed" : null,
    affectedMovementIds,
    inventoryEffects: Object.freeze(inventoryEffects),
  });
}
