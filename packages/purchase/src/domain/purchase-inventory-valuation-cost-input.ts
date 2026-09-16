import {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
} from "./purchase-domain-errors.ts";
import type { PurchaseDomainErrorCode } from "./purchase-domain-errors.ts";
import { normalizePurchaseQuantity } from "./purchase-commercial-semantics.ts";
import type { PurchaseCommercialTerms } from "./purchase-commercial-semantics.ts";
import { calculatePurchaseLineTotals } from "./purchase-pricing.ts";
import type { PurchaseReceiptInvoiceMatchSnapshot } from "./purchase-receipt-invoice-matching.ts";

export interface PurchaseValuationMovementReference {
  readonly movementId: string;
  readonly companyId: string;
  readonly documentId: string;
  readonly lineId: string;
  readonly stockKey: {
    readonly companyId: string;
    readonly productId: string;
    readonly warehouseId: string;
    readonly zoneId: string | null;
    readonly locationId: string | null;
  };
  readonly quantityDelta: string;
}

export interface PurchaseInventoryValuationCommercialFact {
  readonly companyId: string;
  readonly purchaseDocumentId: string;
  readonly purchaseLineId: string;
  readonly documentType: "supplier-invoice" | string;
  readonly status: "confirmed" | string;
  readonly lineKind: "stock-product" | "non-stock-product" | "service";
  readonly productId: string;
  readonly commercialTerms: PurchaseCommercialTerms;
}

export interface PurchaseInventoryValuationSourceLink {
  readonly matchId: string;
  readonly purchaseDocumentId: string;
  readonly purchaseLineId: string;
  readonly receiptDocumentId: string;
  readonly receiptLineId: string;
  readonly productId: string;
  readonly matchedBaseQuantity: string;
  readonly allocatedBaseCost: number;
}

/** Structurally compatible with InventoryResolvedInboundCostBasis. */
export interface PurchaseInventoryResolvedInboundCostBasis {
  readonly basisLineId: string;
  readonly movementId: string;
  readonly productId: string;
  readonly warehouseId: string;
  readonly quantity: string;
  readonly currency: string;
  readonly baseCost: number;
  readonly landedCost: number;
  readonly totalCost: number;
  readonly unitCost: string;
  readonly allocations: readonly [];
}

export interface PurchaseInventoryValuationCostInputSnapshot {
  readonly costInputId: string;
  readonly companyId: string;
  readonly movementId: string;
  readonly receiptDocumentId: string;
  readonly receiptLineId: string;
  readonly productId: string;
  readonly sources: readonly PurchaseInventoryValuationSourceLink[];
  readonly basis: PurchaseInventoryResolvedInboundCostBasis;
}

export interface CreatePurchaseInventoryValuationCostInputInput {
  readonly costInputId: string;
  readonly movement: PurchaseValuationMovementReference;
  readonly matches: readonly PurchaseReceiptInvoiceMatchSnapshot[];
  readonly commercialFacts: readonly PurchaseInventoryValuationCommercialFact[];
}

export interface PurchaseInventoryValuationCostInputResolver {
  resolve(
    companyId: string,
    movement: PurchaseValuationMovementReference,
  ): Promise<PurchaseInventoryValuationCostInputSnapshot | null>;
}

export interface PurchaseInventoryValuationCostInputProvider {
  getResolvedInboundCostBasis(
    companyId: string,
    movement: PurchaseValuationMovementReference,
  ): Promise<PurchaseInventoryResolvedInboundCostBasis | null>;
}

type Decimal = { readonly coefficient: bigint; readonly scale: number };

const fail = (code: PurchaseDomainErrorCode, field: string): never => {
  throw new PurchaseDomainError(code, field);
};

function required(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.identityRequired, field);
  }
  return value.trim();
}

function parsePositiveQuantity(value: string, field: string): Decimal {
  if (typeof value !== "string" || value.trim().startsWith("-")) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostInvalid, field);
  }
  let normalized: string;
  try { normalized = normalizePurchaseQuantity(value); }
  catch { return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostInvalid, field); }
  const [whole = "0", fraction = ""] = normalized.split(".");
  const coefficient = BigInt(whole + fraction);
  if (coefficient <= 0n) return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostInvalid, field);
  return { coefficient, scale: fraction.length };
}

const power = (scale: number): bigint => 10n ** BigInt(scale);

function compareDecimal(left: Decimal, right: Decimal): number {
  const scale = Math.max(left.scale, right.scale);
  const a = left.coefficient * power(scale - left.scale);
  const b = right.coefficient * power(scale - right.scale);
  return a === b ? 0 : a < b ? -1 : 1;
}

function addDecimal(left: Decimal, right: Decimal): Decimal {
  const scale = Math.max(left.scale, right.scale);
  return {
    coefficient: left.coefficient * power(scale - left.scale) + right.coefficient * power(scale - right.scale),
    scale,
  };
}

function roundProportion(amount: number, part: Decimal, whole: Decimal): number {
  if (!Number.isSafeInteger(amount) || amount < 0 || whole.coefficient <= 0n) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostInvalid, "costAllocation");
  }
  const numerator = BigInt(amount) * part.coefficient * power(whole.scale);
  const denominator = whole.coefficient * power(part.scale);
  let quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder * 2n >= denominator) quotient += 1n;
  const value = Number(quotient);
  if (!Number.isSafeInteger(value)) return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostInvalid, "costAllocation");
  return value;
}

function unitCost(totalCost: number, quantity: Decimal): string {
  const scale = 12;
  const numerator = BigInt(totalCost) * power(quantity.scale + scale);
  let quotient = numerator / quantity.coefficient;
  const remainder = numerator % quantity.coefficient;
  if (remainder * 2n >= quantity.coefficient) quotient += 1n;
  let digits = quotient.toString().padStart(scale + 1, "0");
  const raw = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`
    .replace(/\.0+$/u, "")
    .replace(/(\.\d*?)0+$/u, "$1");
  return raw;
}

function factKey(documentId: string, lineId: string): string {
  return JSON.stringify([documentId, lineId]);
}

function matchSort(left: PurchaseReceiptInvoiceMatchSnapshot, right: PurchaseReceiptInvoiceMatchSnapshot): number {
  const a = JSON.stringify([left.receiptDocumentId, left.receiptLineId, left.matchId]);
  const b = JSON.stringify([right.receiptDocumentId, right.receiptLineId, right.matchId]);
  return a === b ? 0 : a < b ? -1 : 1;
}

function allocationForMatch(
  target: PurchaseReceiptInvoiceMatchSnapshot,
  allMatches: readonly PurchaseReceiptInvoiceMatchSnapshot[],
  fact: PurchaseInventoryValuationCommercialFact,
): number {
  const lineCost = calculatePurchaseLineTotals(fact.commercialTerms).taxBaseAmount;
  const invoiceQuantity = parsePositiveQuantity(fact.commercialTerms.quantity.baseQuantity, "commercialFacts.commercialTerms.quantity.baseQuantity");
  const relevant = allMatches
    .filter(match => match.invoiceDocumentId === target.invoiceDocumentId &&
      match.invoiceLineId === target.invoiceLineId && match.productId === target.productId)
    .slice()
    .sort(matchSort);

  let cumulative: Decimal = { coefficient: 0n, scale: 0 };
  let previouslyAllocated = 0;
  for (const match of relevant) {
    const matched = parsePositiveQuantity(match.matchedBaseQuantity, "matches.matchedBaseQuantity");
    cumulative = addDecimal(cumulative, matched);
    if (compareDecimal(cumulative, invoiceQuantity) > 0) {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostMismatch, "matches.matchedBaseQuantity");
    }
    const allocatedThrough = roundProportion(lineCost, cumulative, invoiceQuantity);
    const allocation = allocatedThrough - previouslyAllocated;
    if (match.matchId === target.matchId) return allocation;
    previouslyAllocated = allocatedThrough;
  }
  return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostMismatch, "matches.matchId");
}

export function createPurchaseInventoryValuationCostInput(
  input: CreatePurchaseInventoryValuationCostInputInput,
): PurchaseInventoryValuationCostInputSnapshot | null {
  if (!input || typeof input !== "object" || !input.movement || !Array.isArray(input.matches) || !Array.isArray(input.commercialFacts)) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostInvalid, "input");
  }
  const costInputId = required(input.costInputId, "costInputId");
  const movement = input.movement;
  const companyId = required(movement.companyId, "movement.companyId");
  if (movement.stockKey?.companyId !== companyId) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostMismatch, "movement.stockKey.companyId");
  }
  const movementQuantity = parsePositiveQuantity(movement.quantityDelta, "movement.quantityDelta");
  const productId = required(movement.stockKey?.productId, "movement.stockKey.productId");
  const receiptDocumentId = required(movement.documentId, "movement.documentId");
  const receiptLineId = required(movement.lineId, "movement.lineId");

  const movementMatches = input.matches.filter(match =>
    match.receiptDocumentId === receiptDocumentId && match.receiptLineId === receiptLineId,
  );
  if (movementMatches.length === 0) return null;

  let matchedQuantity: Decimal = { coefficient: 0n, scale: 0 };
  for (const match of movementMatches) {
    if (match.companyId !== companyId || match.productId !== productId) {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostMismatch, "matches");
    }
    matchedQuantity = addDecimal(matchedQuantity, parsePositiveQuantity(match.matchedBaseQuantity, "matches.matchedBaseQuantity"));
  }
  const movementCoverage = compareDecimal(matchedQuantity, movementQuantity);
  if (movementCoverage < 0) return null;
  if (movementCoverage > 0) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostMismatch, "matches.matchedBaseQuantity");
  }

  const facts = new Map<string, PurchaseInventoryValuationCommercialFact>();
  for (let index = 0; index < input.commercialFacts.length; index += 1) {
    const fact = input.commercialFacts[index]!;
    const key = factKey(fact.purchaseDocumentId, fact.purchaseLineId);
    if (facts.has(key)) return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostInvalid, `commercialFacts[${index}]`);
    facts.set(key, fact);
  }

  let currency: string | null = null;
  let baseCost = 0;
  const sources: PurchaseInventoryValuationSourceLink[] = [];
  for (const match of movementMatches.slice().sort(matchSort)) {
    const fact = facts.get(factKey(match.invoiceDocumentId, match.invoiceLineId));
    if (!fact) return null;
    if (fact.documentType !== "supplier-invoice" || fact.status !== "confirmed" || fact.lineKind !== "stock-product") {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostIneligible, `commercialFacts[${input.commercialFacts.indexOf(fact)}].${fact.lineKind !== "stock-product" ? "lineKind" : fact.status !== "confirmed" ? "status" : "documentType"}`);
    }
    if (fact.companyId !== companyId || fact.productId !== productId ||
        fact.purchaseDocumentId !== match.invoiceDocumentId || fact.purchaseLineId !== match.invoiceLineId) {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostMismatch, `commercialFacts[${input.commercialFacts.indexOf(fact)}].productId`);
    }
    const factCurrency = fact.commercialTerms.unitPrice.currency;
    if (currency !== null && currency !== factCurrency) {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.currencyMismatch, "commercialFacts.currency");
    }
    currency = factCurrency;
    const allocatedBaseCost = allocationForMatch(match, input.matches, fact);
    baseCost += allocatedBaseCost;
    if (!Number.isSafeInteger(baseCost)) return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostInvalid, "baseCost");
    sources.push(Object.freeze({
      matchId: match.matchId,
      purchaseDocumentId: match.invoiceDocumentId,
      purchaseLineId: match.invoiceLineId,
      receiptDocumentId: match.receiptDocumentId,
      receiptLineId: match.receiptLineId,
      productId: match.productId,
      matchedBaseQuantity: match.matchedBaseQuantity,
      allocatedBaseCost,
    }));
  }
  if (currency === null) return null;

  const quantity = normalizePurchaseQuantity(movement.quantityDelta);
  const basis = Object.freeze({
    basisLineId: costInputId,
    movementId: required(movement.movementId, "movement.movementId"),
    productId,
    warehouseId: required(movement.stockKey.warehouseId, "movement.stockKey.warehouseId"),
    quantity,
    currency,
    baseCost,
    landedCost: 0,
    totalCost: baseCost,
    unitCost: unitCost(baseCost, movementQuantity),
    allocations: Object.freeze([]) as readonly [],
  });

  return Object.freeze({
    costInputId,
    companyId,
    movementId: basis.movementId,
    receiptDocumentId,
    receiptLineId,
    productId,
    sources: Object.freeze(sources),
    basis,
  });
}

export function createPurchaseInventoryValuationCostInputProvider(
  resolver: PurchaseInventoryValuationCostInputResolver,
): PurchaseInventoryValuationCostInputProvider {
  if (!resolver || typeof resolver.resolve !== "function") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostInvalid, "resolver");
  }
  return Object.freeze({
    async getResolvedInboundCostBasis(companyId: string, movement: PurchaseValuationMovementReference) {
      const requestedCompanyId = required(companyId, "companyId");
      if (movement.companyId !== requestedCompanyId) {
        return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostMismatch, "movement.companyId");
      }
      const linked = await resolver.resolve(requestedCompanyId, movement);
      if (linked === null) return null;
      if (linked.companyId !== requestedCompanyId || linked.movementId !== movement.movementId) {
        return fail(PURCHASE_DOMAIN_ERROR_CODES.inventoryValuationCostMismatch, "resolvedCostInput");
      }
      return linked.basis;
    },
  });
}
