import { PURCHASE_DOMAIN_ERROR_CODES, PurchaseDomainError } from "./purchase-domain-errors.ts";
import type { PurchaseDomainErrorCode } from "./purchase-domain-errors.ts";
import { normalizePurchaseQuantity } from "./purchase-commercial-semantics.ts";
import {
  createPurchaseInventoryValuationCostInput,
} from "./purchase-inventory-valuation-cost-input.ts";
import type {
  CreatePurchaseInventoryValuationCostInputInput,
  PurchaseInventoryValuationCostInputSnapshot,
} from "./purchase-inventory-valuation-cost-input.ts";

export const PURCHASE_RECEIPT_COST_RESOLUTION_STATUSES = Object.freeze([
  "unresolved",
  "resolved",
] as const);

export type PurchaseReceiptCostResolutionStatus =
  (typeof PURCHASE_RECEIPT_COST_RESOLUTION_STATUSES)[number];

export const PURCHASE_RECEIPT_COST_UNRESOLVED_REASONS = Object.freeze([
  "awaiting-supplier-invoice",
  "partial-invoice-match",
  "supplier-invoice-cost-unavailable",
] as const);

export type PurchaseReceiptCostUnresolvedReason =
  (typeof PURCHASE_RECEIPT_COST_UNRESOLVED_REASONS)[number];

export interface PurchaseReceiptBeforeInvoiceCostDecision {
  readonly status: PurchaseReceiptCostResolutionStatus;
  readonly reason: PurchaseReceiptCostUnresolvedReason | null;
  readonly movementBaseQuantity: string;
  readonly matchedBaseQuantity: string;
  readonly remainingBaseQuantity: string;
  readonly costInput: PurchaseInventoryValuationCostInputSnapshot | null;
  readonly blocksInventoryConfirmation: false;
  readonly requiresRecalculation: true;
  readonly recalculationReason: "cost_basis_changed";
}

type Decimal = { readonly coefficient: bigint; readonly scale: number };

const fail = (code: PurchaseDomainErrorCode, field: string): never => {
  throw new PurchaseDomainError(code, field);
};

const power = (scale: number): bigint => 10n ** BigInt(scale);

function parse(value: string, field: string, allowZero = false): Decimal {
  let canonical: string;
  try { canonical = normalizePurchaseQuantity(value); }
  catch { return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostInvalid, field); }
  const [whole = "0", fraction = ""] = canonical.split(".");
  const coefficient = BigInt(whole + fraction);
  if ((!allowZero && coefficient <= 0n) || coefficient < 0n) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostInvalid, field);
  }
  return { coefficient, scale: fraction.length };
}

function align(left: Decimal, right: Decimal): readonly [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale);
  return [
    left.coefficient * power(scale - left.scale),
    right.coefficient * power(scale - right.scale),
    scale,
  ];
}

function add(left: Decimal, right: Decimal): Decimal {
  const [a, b, scale] = align(left, right);
  return { coefficient: a + b, scale };
}

function subtract(left: Decimal, right: Decimal): Decimal {
  const [a, b, scale] = align(left, right);
  if (b > a) return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostMismatch, "matches.matchedBaseQuantity");
  return { coefficient: a - b, scale };
}

function compare(left: Decimal, right: Decimal): number {
  const [a, b] = align(left, right);
  return a === b ? 0 : a < b ? -1 : 1;
}

function format(value: Decimal): string {
  const digits = value.coefficient.toString().padStart(value.scale + 1, "0");
  const raw = value.scale === 0
    ? digits
    : `${digits.slice(0, -value.scale)}.${digits.slice(-value.scale)}`;
  return raw.replace(/\.0+$/u, "").replace(/(\.\d*?)0+$/u, "$1");
}

function unresolved(
  reason: PurchaseReceiptCostUnresolvedReason,
  movementQuantity: Decimal,
  matchedQuantity: Decimal,
): PurchaseReceiptBeforeInvoiceCostDecision {
  return Object.freeze({
    status: "unresolved" as const,
    reason,
    movementBaseQuantity: format(movementQuantity),
    matchedBaseQuantity: format(matchedQuantity),
    remainingBaseQuantity: format(subtract(movementQuantity, matchedQuantity)),
    costInput: null,
    blocksInventoryConfirmation: false as const,
    requiresRecalculation: true as const,
    recalculationReason: "cost_basis_changed" as const,
  });
}

export function evaluatePurchaseReceiptBeforeInvoiceCost(
  input: CreatePurchaseInventoryValuationCostInputInput,
): PurchaseReceiptBeforeInvoiceCostDecision {
  if (!input || typeof input !== "object" || !input.movement || !Array.isArray(input.matches) || !Array.isArray(input.commercialFacts)) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostInvalid, "input");
  }

  const movementQuantity = parse(input.movement.quantityDelta, "movement.quantityDelta");
  let matchedQuantity: Decimal = { coefficient: 0n, scale: 0 };
  const movementMatches = input.matches.filter(match =>
    match.receiptDocumentId === input.movement.documentId &&
    match.receiptLineId === input.movement.lineId,
  );

  for (const match of movementMatches) {
    if (match.companyId !== input.movement.companyId || match.productId !== input.movement.stockKey.productId) {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostMismatch, "matches");
    }
    matchedQuantity = add(matchedQuantity, parse(match.matchedBaseQuantity, "matches.matchedBaseQuantity"));
  }

  const coverage = compare(matchedQuantity, movementQuantity);
  if (coverage > 0) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostMismatch, "matches.matchedBaseQuantity");
  }
  if (movementMatches.length === 0) {
    return unresolved("awaiting-supplier-invoice", movementQuantity, matchedQuantity);
  }
  if (coverage < 0) {
    return unresolved("partial-invoice-match", movementQuantity, matchedQuantity);
  }

  const costInput = createPurchaseInventoryValuationCostInput(input);
  if (costInput === null) {
    return unresolved("supplier-invoice-cost-unavailable", movementQuantity, matchedQuantity);
  }

  return Object.freeze({
    status: "resolved" as const,
    reason: null,
    movementBaseQuantity: format(movementQuantity),
    matchedBaseQuantity: format(matchedQuantity),
    remainingBaseQuantity: "0",
    costInput,
    blocksInventoryConfirmation: false as const,
    requiresRecalculation: true as const,
    recalculationReason: "cost_basis_changed" as const,
  });
}
