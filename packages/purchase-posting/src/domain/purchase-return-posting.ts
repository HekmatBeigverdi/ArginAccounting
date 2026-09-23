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
import {
  createPurchaseTaxPolicy,
} from "./purchase-tax-posting.ts";
import type {
  CreatePurchaseTaxPolicyInput,
  PurchaseTaxRecoverability,
} from "./purchase-tax-posting.ts";

export type PurchaseReturnPostingSide = "debit" | "credit";

export type PurchaseReturnAmountBasis =
  | "document-grand-total"
  | "commercial-net-after-discount"
  | "commercial-charge"
  | "commercial-tax"
  | "inventory-outbound-valuation";

export interface PurchaseReturnSourceReference {
  readonly originalSupplierInvoiceId: string;
}

export interface PurchaseReturnPostingComponent {
  readonly componentId: string;
  readonly purchaseLineId: string | null;
  readonly side: PurchaseReturnPostingSide;
  readonly accountRole: PurchasePostingAccountRole;
  readonly amountBasis: PurchaseReturnAmountBasis;
  readonly amount: number | null;
  readonly currency: string;
  readonly deferredToStep: 12 | null;
  readonly absorbedByInventoryValuation: boolean;
}

export interface PurchaseReturnPostingPlan {
  readonly factId: string;
  readonly purchaseDocumentId: string;
  readonly originalSupplierInvoiceId: string;
  readonly eventKind: "purchase-return-recognition";
  readonly taxRecoverability: PurchaseTaxRecoverability;
  readonly components: readonly PurchaseReturnPostingComponent[];
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

function required(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.purchaseReturnReferenceInvalid, field);
  }
  return value.trim();
}

function checkedAdd(left: number, right: number, field: string): number {
  const value = left + right;
  if (!Number.isSafeInteger(value) || value < 0) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.purchaseReturnAmountInvalid, field);
  }
  return value;
}

function stockComponent(
  line: PurchasePostingLineFactSnapshot,
): PurchaseReturnPostingComponent {
  return Object.freeze({
    componentId: `principal:${line.purchaseLineId}`,
    purchaseLineId: line.purchaseLineId,
    side: "credit",
    accountRole: "inventory-asset",
    amountBasis: "inventory-outbound-valuation",
    amount: null,
    currency: line.amounts.currency,
    deferredToStep: 12,
    absorbedByInventoryValuation: true,
  });
}

export function createPurchaseReturnPostingPlan(
  fact: PurchasePostingFactSnapshot,
  referenceInput: PurchaseReturnSourceReference,
  taxPolicyInput: CreatePurchaseTaxPolicyInput,
): PurchaseReturnPostingPlan {
  if (typeof fact !== "object" || fact === null || Array.isArray(fact)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.purchaseReturnInvalid, "fact");
  }

  const classification = classifyPurchasePostingFact(fact);
  if (
    classification.disposition !== "posting"
    || classification.eventKind !== "purchase-return-recognition"
  ) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.purchaseReturnInvalid, "fact");
  }

  if (typeof referenceInput !== "object" || referenceInput === null || Array.isArray(referenceInput)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.purchaseReturnReferenceInvalid, "reference");
  }
  const originalSupplierInvoiceId = required(
    referenceInput.originalSupplierInvoiceId,
    "reference.originalSupplierInvoiceId",
  );
  if (originalSupplierInvoiceId === fact.purchaseDocumentId) {
    return fail(
      PURCHASE_POSTING_DOMAIN_ERROR_CODES.purchaseReturnReferenceInvalid,
      "reference.originalSupplierInvoiceId",
    );
  }

  const taxPolicy = createPurchaseTaxPolicy(taxPolicyInput);
  if (taxPolicy.companyId !== fact.companyId) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.scopeMismatch, "taxPolicy.companyId");
  }

  const components: PurchaseReturnPostingComponent[] = [];
  let principalAmount = 0;
  let chargeAmount = 0;
  let taxAmount = 0;

  for (const line of fact.lines) {
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

    if (line.lineKind === "stock-product") {
      components.push(stockComponent(line));

      if (line.amounts.taxAmount > 0 && taxPolicy.recoverability === "recoverable") {
        components.push(Object.freeze({
          componentId: `tax:${line.purchaseLineId}`,
          purchaseLineId: line.purchaseLineId,
          side: "credit",
          accountRole: "input-vat-recoverable",
          amountBasis: "commercial-tax",
          amount: line.amounts.taxAmount,
          currency: line.amounts.currency,
          deferredToStep: null,
          absorbedByInventoryValuation: false,
        }));
      }
      continue;
    }

    components.push(Object.freeze({
      componentId: `principal:${line.purchaseLineId}`,
      purchaseLineId: line.purchaseLineId,
      side: "credit",
      accountRole: "purchase-expense",
      amountBasis: "commercial-net-after-discount",
      amount: line.amounts.netAfterDiscount,
      currency: line.amounts.currency,
      deferredToStep: null,
      absorbedByInventoryValuation: false,
    }));

    if (line.amounts.chargeAmount > 0) {
      components.push(Object.freeze({
        componentId: `charge:${line.purchaseLineId}`,
        purchaseLineId: line.purchaseLineId,
        side: "credit",
        accountRole: "purchase-charge",
        amountBasis: "commercial-charge",
        amount: line.amounts.chargeAmount,
        currency: line.amounts.currency,
        deferredToStep: null,
        absorbedByInventoryValuation: false,
      }));
    }

    if (line.amounts.taxAmount > 0) {
      components.push(Object.freeze({
        componentId: `tax:${line.purchaseLineId}`,
        purchaseLineId: line.purchaseLineId,
        side: "credit",
        accountRole: taxPolicy.recoverability === "recoverable"
          ? "input-vat-recoverable"
          : "purchase-expense",
        amountBasis: "commercial-tax",
        amount: line.amounts.taxAmount,
        currency: line.amounts.currency,
        deferredToStep: null,
        absorbedByInventoryValuation: false,
      }));
    }
  }

  components.push(Object.freeze({
    componentId: "supplier-payable",
    purchaseLineId: null,
    side: "debit",
    accountRole: "accounts-payable",
    amountBasis: "document-grand-total",
    amount: fact.totals.grandTotal,
    currency: fact.totals.currency,
    deferredToStep: null,
    absorbedByInventoryValuation: false,
  }));

  const expectedGrandTotal = checkedAdd(
    checkedAdd(principalAmount, chargeAmount, "commercialControl.grandTotal"),
    taxAmount,
    "commercialControl.grandTotal",
  );
  if (expectedGrandTotal !== fact.totals.grandTotal) {
    return fail(
      PURCHASE_POSTING_DOMAIN_ERROR_CODES.purchaseReturnAmountInvalid,
      "commercialControl.grandTotal",
    );
  }

  return Object.freeze({
    factId: fact.factId,
    purchaseDocumentId: fact.purchaseDocumentId,
    originalSupplierInvoiceId,
    eventKind: "purchase-return-recognition",
    taxRecoverability: taxPolicy.recoverability,
    components: Object.freeze(components),
    commercialControl: Object.freeze({
      principalAmount,
      chargeAmount,
      taxAmount,
      grandTotal: fact.totals.grandTotal,
    }),
  });
}
