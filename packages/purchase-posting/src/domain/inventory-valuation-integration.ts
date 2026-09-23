import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
} from "./purchase-posting-domain-errors.ts";
import type { PurchasePostingDomainErrorCode } from "./purchase-posting-domain-errors.ts";
import type {
  PurchasePostingFactSnapshot,
  PurchasePostingLineFactSnapshot,
  PurchasePostingValuationSnapshot,
} from "./purchase-posting-facts.ts";
import type {
  SupplierInvoicePostingComponent,
  SupplierInvoicePostingPlan,
} from "./supplier-invoice-posting.ts";
import type {
  PurchaseReturnPostingComponent,
  PurchaseReturnPostingPlan,
} from "./purchase-return-posting.ts";
import type {
  PurchaseCorrectionPostingComponent,
  PurchaseCorrectionPostingPlan,
} from "./purchase-correction-posting.ts";

export interface PurchasePostingResolvedValuation {
  readonly purchaseLineId: string;
  readonly valuationEntryIds: readonly string[];
  readonly movementIds: readonly string[];
  readonly policyIds: readonly string[];
  readonly methods: readonly ("fifo" | "moving_average")[];
  readonly strategyVersions: readonly number[];
  readonly currency: string;
  readonly signedTotalCost: number;
  readonly amount: number;
}

export interface ResolvedSupplierInvoicePostingPlan extends SupplierInvoicePostingPlan {
  readonly components: readonly SupplierInvoicePostingComponent[];
  readonly resolvedValuations: readonly PurchasePostingResolvedValuation[];
}

export interface ResolvedPurchaseReturnPostingPlan extends PurchaseReturnPostingPlan {
  readonly components: readonly PurchaseReturnPostingComponent[];
  readonly resolvedValuations: readonly PurchasePostingResolvedValuation[];
}

export interface ResolvedPurchaseCorrectionPostingPlan extends PurchaseCorrectionPostingPlan {
  readonly components: readonly PurchaseCorrectionPostingComponent[];
  readonly resolvedValuations: readonly PurchasePostingResolvedValuation[];
}

const fail = (code: PurchasePostingDomainErrorCode, field: string): never => {
  throw new PurchasePostingDomainError(code, field);
};

function lineById(
  fact: PurchasePostingFactSnapshot,
  lineId: string,
  field: string,
): PurchasePostingLineFactSnapshot {
  const line = fact.lines.find(item => item.purchaseLineId === lineId);
  if (!line) return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.inventoryValuationMismatch, field);
  return line;
}

function checkedSum(values: readonly number[], field: string): number {
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value)) {
      return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.inventoryValuationAmountInvalid, field);
    }
    total += value;
    if (!Number.isSafeInteger(total)) {
      return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.inventoryValuationAmountInvalid, field);
    }
  }
  return total;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

function uniqueSortedNumbers(values: readonly number[]): readonly number[] {
  return Object.freeze([...new Set(values)].sort((a, b) => a - b));
}

function summarize(
  fact: PurchasePostingFactSnapshot,
  line: PurchasePostingLineFactSnapshot,
  direction: "inbound" | "outbound" | "either",
): PurchasePostingResolvedValuation {
  if (line.lineKind !== "stock-product") {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.inventoryValuationMismatch, "line.lineKind");
  }
  if (line.valuations.length === 0) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.inventoryValuationMissing, line.purchaseLineId);
  }

  for (let index = 0; index < line.valuations.length; index += 1) {
    const valuation = line.valuations[index]!;
    if (
      valuation.companyId !== fact.companyId
      || valuation.productId !== line.item.itemId
      || valuation.currency !== line.amounts.currency
    ) {
      return fail(
        PURCHASE_POSTING_DOMAIN_ERROR_CODES.inventoryValuationMismatch,
        `${line.purchaseLineId}.valuations[${index}]`,
      );
    }
  }

  const signedTotalCost = checkedSum(
    line.valuations.map(item => item.totalCost),
    `${line.purchaseLineId}.totalCost`,
  );

  if (direction === "inbound" && signedTotalCost < 0) {
    return fail(
      PURCHASE_POSTING_DOMAIN_ERROR_CODES.inventoryValuationDirectionInvalid,
      line.purchaseLineId,
    );
  }
  if (direction === "outbound" && signedTotalCost > 0) {
    return fail(
      PURCHASE_POSTING_DOMAIN_ERROR_CODES.inventoryValuationDirectionInvalid,
      line.purchaseLineId,
    );
  }

  const amount = Math.abs(signedTotalCost);
  if (!Number.isSafeInteger(amount)) {
    return fail(
      PURCHASE_POSTING_DOMAIN_ERROR_CODES.inventoryValuationAmountInvalid,
      line.purchaseLineId,
    );
  }

  return Object.freeze({
    purchaseLineId: line.purchaseLineId,
    valuationEntryIds: uniqueSorted(line.valuations.map(item => item.valuationEntryId)),
    movementIds: uniqueSorted(line.valuations.map(item => item.movementId)),
    policyIds: uniqueSorted(line.valuations.map(item => item.policyId)),
    methods: uniqueSorted(line.valuations.map(item => item.method)) as readonly ("fifo" | "moving_average")[],
    strategyVersions: uniqueSortedNumbers(line.valuations.map(item => item.strategyVersion)),
    currency: line.amounts.currency,
    signedTotalCost,
    amount,
  });
}

function replaceComponentAmount<T extends {
  readonly componentId: string;
  readonly amount: number | null;
  readonly deferredToStep: number | null;
}>(
  component: T,
  amount: number,
): T {
  return Object.freeze({
    ...component,
    amount,
    deferredToStep: null,
  });
}

export function resolveSupplierInvoiceInventoryValuation(
  fact: PurchasePostingFactSnapshot,
  plan: SupplierInvoicePostingPlan,
): ResolvedSupplierInvoicePostingPlan {
  if (
    fact.factId !== plan.factId
    || fact.purchaseDocumentId !== plan.purchaseDocumentId
    || plan.eventKind !== "supplier-invoice-recognition"
  ) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.inventoryValuationMismatch, "supplierInvoicePlan");
  }

  const resolvedValuations: PurchasePostingResolvedValuation[] = [];
  const byLine = new Map<string, PurchasePostingResolvedValuation>();

  const components = plan.components.map(component => {
    if (
      component.amountBasis !== "inventory-valuation"
      || component.deferredToStep !== 12
      || component.purchaseLineId === null
    ) return component;

    const line = lineById(fact, component.purchaseLineId, "component.purchaseLineId");
    const resolved = summarize(fact, line, "inbound");
    resolvedValuations.push(resolved);
    byLine.set(line.purchaseLineId, resolved);
    return replaceComponentAmount(component, resolved.amount);
  });

  return Object.freeze({
    ...plan,
    components: Object.freeze(components),
    resolvedValuations: Object.freeze(resolvedValuations),
  });
}

export function resolvePurchaseReturnInventoryValuation(
  fact: PurchasePostingFactSnapshot,
  plan: PurchaseReturnPostingPlan,
): ResolvedPurchaseReturnPostingPlan {
  if (
    fact.factId !== plan.factId
    || fact.purchaseDocumentId !== plan.purchaseDocumentId
    || plan.eventKind !== "purchase-return-recognition"
  ) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.inventoryValuationMismatch, "purchaseReturnPlan");
  }

  const resolvedValuations: PurchasePostingResolvedValuation[] = [];

  const components = plan.components.map(component => {
    if (
      component.amountBasis !== "inventory-outbound-valuation"
      || component.deferredToStep !== 12
      || component.purchaseLineId === null
    ) return component;

    const line = lineById(fact, component.purchaseLineId, "component.purchaseLineId");
    const resolved = summarize(fact, line, "outbound");
    resolvedValuations.push(resolved);
    return replaceComponentAmount(component, resolved.amount);
  });

  return Object.freeze({
    ...plan,
    components: Object.freeze(components),
    resolvedValuations: Object.freeze(resolvedValuations),
  });
}

function valuationDelta(
  originalFact: PurchasePostingFactSnapshot,
  originalLine: PurchasePostingLineFactSnapshot,
  correctionFact: PurchasePostingFactSnapshot,
  correctionLine: PurchasePostingLineFactSnapshot,
  effect: "commercial-replacement" | "quantity-decrease" | "quantity-increase",
): {
  readonly signedDelta: number;
  readonly provenance: readonly PurchasePostingResolvedValuation[];
} {
  if (effect === "commercial-replacement") {
    const original = summarize(originalFact, originalLine, "inbound");
    const corrected = summarize(correctionFact, correctionLine, "inbound");
    const signedDelta = checkedSum(
      [corrected.signedTotalCost, -original.signedTotalCost],
      `${correctionLine.purchaseLineId}.valuationDelta`,
    );
    return Object.freeze({
      signedDelta,
      provenance: Object.freeze([original, corrected]),
    });
  }

  const correction = summarize(
    correctionFact,
    correctionLine,
    effect === "quantity-increase" ? "inbound" : "outbound",
  );
  return Object.freeze({
    signedDelta: correction.signedTotalCost,
    provenance: Object.freeze([correction]),
  });
}

export function resolvePurchaseCorrectionInventoryValuation(
  originalInvoiceFact: PurchasePostingFactSnapshot,
  correctionFact: PurchasePostingFactSnapshot,
  plan: PurchaseCorrectionPostingPlan,
): ResolvedPurchaseCorrectionPostingPlan {
  if (
    correctionFact.factId !== plan.factId
    || correctionFact.purchaseDocumentId !== plan.purchaseDocumentId
    || originalInvoiceFact.purchaseDocumentId !== plan.originalSupplierInvoiceId
    || plan.eventKind !== "purchase-correction-recognition"
  ) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.inventoryValuationMismatch, "purchaseCorrectionPlan");
  }

  const resolvedValuations: PurchasePostingResolvedValuation[] = [];

  const components = plan.components.map(component => {
    if (
      component.amountBasis !== "inventory-valuation-delta"
      || component.deferredToStep !== 12
      || component.correctionPurchaseLineId === null
      || component.originalPurchaseLineId === null
      || component.effect === "document-payable"
    ) return component;

    const originalLine = lineById(
      originalInvoiceFact,
      component.originalPurchaseLineId,
      "component.originalPurchaseLineId",
    );
    const correctionLine = lineById(
      correctionFact,
      component.correctionPurchaseLineId,
      "component.correctionPurchaseLineId",
    );

    const delta = valuationDelta(
      originalInvoiceFact,
      originalLine,
      correctionFact,
      correctionLine,
      component.effect,
    );
    resolvedValuations.push(...delta.provenance);

    const amount = Math.abs(delta.signedDelta);
    if (!Number.isSafeInteger(amount)) {
      return fail(
        PURCHASE_POSTING_DOMAIN_ERROR_CODES.inventoryValuationAmountInvalid,
        component.componentId,
      );
    }

    const side = delta.signedDelta >= 0 ? "debit" : "credit";
    return Object.freeze({
      ...component,
      side,
      amount,
      deferredToStep: null,
    });
  });

  return Object.freeze({
    ...plan,
    components: Object.freeze(components),
    resolvedValuations: Object.freeze(resolvedValuations),
  });
}
