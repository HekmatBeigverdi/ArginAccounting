import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
} from "./purchase-posting-domain-errors.ts";
import type { PurchasePostingDomainErrorCode } from "./purchase-posting-domain-errors.ts";
import {
  classifyPurchasePostingFact,
} from "./purchase-posting-event-classification.ts";
import type {
  PurchasePostingFactSnapshot,
  PurchasePostingLineFactSnapshot,
} from "./purchase-posting-facts.ts";
import type {
  PurchasePostingAccountRole,
} from "./purchase-posting-rules.ts";

export type SupplierInvoicePostingSide = "debit" | "credit";

export type SupplierInvoiceAmountBasis =
  | "commercial-net-after-discount"
  | "inventory-valuation"
  | "document-grand-total"
  | "deferred-tax"
  | "deferred-charge";

export interface SupplierInvoicePostingComponent {
  readonly componentId: string;
  readonly purchaseLineId: string | null;
  readonly side: SupplierInvoicePostingSide;
  readonly accountRole: PurchasePostingAccountRole;
  readonly amountBasis: SupplierInvoiceAmountBasis;
  readonly amount: number | null;
  readonly currency: string;
  readonly deferredToStep: 8 | 9 | 12 | null;
}

export interface SupplierInvoicePostingPlan {
  readonly factId: string;
  readonly purchaseDocumentId: string;
  readonly eventKind: "supplier-invoice-recognition";
  readonly currency: string;
  readonly components: readonly SupplierInvoicePostingComponent[];
  readonly commercialControl: {
    readonly principalAmount: number;
    readonly chargeAmount: number;
    readonly taxAmount: number;
    readonly grandTotal: number;
  };
}

const fail = (code: PurchasePostingDomainErrorCode, field: string): never => {
  throw new PurchasePostingDomainError(code, field);
};

function checkedAdd(left: number, right: number, field: string): number {
  const value = left + right;
  if (!Number.isSafeInteger(value) || value < 0) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.supplierInvoiceAmountInvalid, field);
  }
  return value;
}

function principalComponent(
  line: PurchasePostingLineFactSnapshot,
): SupplierInvoicePostingComponent {
  if (line.lineKind === "stock-product") {
    return Object.freeze({
      componentId: `principal:${line.purchaseLineId}`,
      purchaseLineId: line.purchaseLineId,
      side: "debit",
      accountRole: "inventory-asset",
      amountBasis: "inventory-valuation",
      amount: null,
      currency: line.amounts.currency,
      deferredToStep: 12,
    });
  }

  return Object.freeze({
    componentId: `principal:${line.purchaseLineId}`,
    purchaseLineId: line.purchaseLineId,
    side: "debit",
    accountRole: "purchase-expense",
    amountBasis: "commercial-net-after-discount",
    amount: line.amounts.netAfterDiscount,
    currency: line.amounts.currency,
    deferredToStep: null,
  });
}

export function createSupplierInvoicePostingPlan(
  fact: PurchasePostingFactSnapshot,
): SupplierInvoicePostingPlan {
  if (typeof fact !== "object" || fact === null || Array.isArray(fact)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.supplierInvoiceInvalid, "fact");
  }

  const classification = classifyPurchasePostingFact(fact);
  if (
    classification.disposition !== "posting"
    || classification.eventKind !== "supplier-invoice-recognition"
  ) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.supplierInvoiceInvalid, "fact");
  }

  const components: SupplierInvoicePostingComponent[] = [];
  let principalAmount = 0;
  let chargeAmount = 0;
  let taxAmount = 0;

  for (const line of fact.lines) {
    const principal = principalComponent(line);
    components.push(principal);
    principalAmount = checkedAdd(
      principalAmount,
      line.amounts.netAfterDiscount,
      "commercialControl.principalAmount",
    );
    chargeAmount = checkedAdd(
      chargeAmount,
      line.amounts.chargeAmount,
      "commercialControl.chargeAmount",
    );
    taxAmount = checkedAdd(
      taxAmount,
      line.amounts.taxAmount,
      "commercialControl.taxAmount",
    );

    if (line.amounts.chargeAmount > 0) {
      components.push(Object.freeze({
        componentId: `charge:${line.purchaseLineId}`,
        purchaseLineId: line.purchaseLineId,
        side: "debit",
        accountRole: "purchase-charge",
        amountBasis: "deferred-charge",
        amount: line.amounts.chargeAmount,
        currency: line.amounts.currency,
        deferredToStep: 9,
      }));
    }

    if (line.amounts.taxAmount > 0) {
      components.push(Object.freeze({
        componentId: `tax:${line.purchaseLineId}`,
        purchaseLineId: line.purchaseLineId,
        side: "debit",
        accountRole: "input-vat-recoverable",
        amountBasis: "deferred-tax",
        amount: line.amounts.taxAmount,
        currency: line.amounts.currency,
        deferredToStep: 8,
      }));
    }
  }

  components.push(Object.freeze({
    componentId: "supplier-payable",
    purchaseLineId: null,
    side: "credit",
    accountRole: "accounts-payable",
    amountBasis: "document-grand-total",
    amount: fact.totals.grandTotal,
    currency: fact.totals.currency,
    deferredToStep: null,
  }));

  const expectedGrandTotal = checkedAdd(
    checkedAdd(principalAmount, chargeAmount, "commercialControl.grandTotal"),
    taxAmount,
    "commercialControl.grandTotal",
  );

  if (expectedGrandTotal !== fact.totals.grandTotal) {
    return fail(
      PURCHASE_POSTING_DOMAIN_ERROR_CODES.supplierInvoiceAmountInvalid,
      "commercialControl.grandTotal",
    );
  }

  return Object.freeze({
    factId: fact.factId,
    purchaseDocumentId: fact.purchaseDocumentId,
    eventKind: "supplier-invoice-recognition",
    currency: fact.totals.currency,
    components: Object.freeze(components),
    commercialControl: Object.freeze({
      principalAmount,
      chargeAmount,
      taxAmount,
      grandTotal: fact.totals.grandTotal,
    }),
  });
}
