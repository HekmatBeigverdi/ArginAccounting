import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
} from "./purchase-posting-domain-errors.ts";
import type { PurchasePostingDomainErrorCode } from "./purchase-posting-domain-errors.ts";
import type {
  PurchasePostingFactSnapshot,
  PurchasePostingLineFactSnapshot,
} from "./purchase-posting-facts.ts";
import type {
  PurchasePostingAccountRole,
} from "./purchase-posting-rules.ts";
import {
  createSupplierInvoicePostingPlan,
} from "./supplier-invoice-posting.ts";

export type PurchaseChargePostingDestination =
  | "inventory-capitalizable-cost"
  | "purchase-charge-expense";

export interface PurchaseChargePostingComponent {
  readonly componentId: string;
  readonly purchaseLineId: string;
  readonly chargeAmount: number;
  readonly currency: string;
  readonly destination: PurchaseChargePostingDestination;
  readonly side: "debit";
  readonly accountRole: PurchasePostingAccountRole;
  readonly includedInPurchaseCostInput: boolean;
  readonly deferredToStep: 12 | null;
}

export interface PurchaseChargePostingPlan {
  readonly factId: string;
  readonly purchaseDocumentId: string;
  readonly components: readonly PurchaseChargePostingComponent[];
  readonly totalChargeAmount: number;
  readonly currency: string;
}

const fail = (code: PurchasePostingDomainErrorCode, field: string): never => {
  throw new PurchasePostingDomainError(code, field);
};

function component(
  line: PurchasePostingLineFactSnapshot,
): PurchaseChargePostingComponent | null {
  if (line.amounts.chargeAmount === 0) return null;

  if (line.lineKind === "stock-product") {
    return Object.freeze({
      componentId: `charge:${line.purchaseLineId}`,
      purchaseLineId: line.purchaseLineId,
      chargeAmount: line.amounts.chargeAmount,
      currency: line.amounts.currency,
      destination: "inventory-capitalizable-cost",
      side: "debit",
      accountRole: "inventory-asset",
      includedInPurchaseCostInput: true,
      deferredToStep: 12,
    });
  }

  return Object.freeze({
    componentId: `charge:${line.purchaseLineId}`,
    purchaseLineId: line.purchaseLineId,
    chargeAmount: line.amounts.chargeAmount,
    currency: line.amounts.currency,
    destination: "purchase-charge-expense",
    side: "debit",
    accountRole: "purchase-charge",
    includedInPurchaseCostInput: false,
    deferredToStep: null,
  });
}

export function createPurchaseChargePostingPlan(
  fact: PurchasePostingFactSnapshot,
): PurchaseChargePostingPlan {
  if (typeof fact !== "object" || fact === null || Array.isArray(fact)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.chargePostingInvalid, "fact");
  }

  createSupplierInvoicePostingPlan(fact);

  const components = fact.lines
    .map(component)
    .filter((value): value is PurchaseChargePostingComponent => value !== null);

  let totalChargeAmount = 0;
  for (const item of components) {
    totalChargeAmount += item.chargeAmount;
    if (!Number.isSafeInteger(totalChargeAmount)) {
      return fail(
        PURCHASE_POSTING_DOMAIN_ERROR_CODES.chargePostingInvalid,
        "totalChargeAmount",
      );
    }
  }

  if (totalChargeAmount !== fact.totals.chargeAmount) {
    return fail(
      PURCHASE_POSTING_DOMAIN_ERROR_CODES.chargePostingInvalid,
      "totalChargeAmount",
    );
  }

  return Object.freeze({
    factId: fact.factId,
    purchaseDocumentId: fact.purchaseDocumentId,
    components: Object.freeze(components),
    totalChargeAmount,
    currency: fact.totals.currency,
  });
}
