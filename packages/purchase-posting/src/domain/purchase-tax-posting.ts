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

export const PURCHASE_TAX_RECOVERABILITY = Object.freeze([
  "recoverable",
  "non-recoverable",
] as const);

export type PurchaseTaxRecoverability =
  (typeof PURCHASE_TAX_RECOVERABILITY)[number];

export interface PurchaseTaxPolicy {
  readonly policyId: string;
  readonly companyId: string;
  readonly recoverability: PurchaseTaxRecoverability;
}

export interface CreatePurchaseTaxPolicyInput extends PurchaseTaxPolicy {}

export type PurchaseTaxPostingDestination =
  | "input-vat-recoverable"
  | "inventory-capitalizable-cost"
  | "purchase-expense";

export interface PurchaseTaxPostingComponent {
  readonly componentId: string;
  readonly purchaseLineId: string;
  readonly taxAmount: number;
  readonly currency: string;
  readonly recoverability: PurchaseTaxRecoverability;
  readonly destination: PurchaseTaxPostingDestination;
  readonly side: "debit";
  readonly accountRole: PurchasePostingAccountRole;
  readonly deferredToStep: 12 | null;
}

export interface PurchaseTaxPostingPlan {
  readonly factId: string;
  readonly purchaseDocumentId: string;
  readonly policyId: string;
  readonly components: readonly PurchaseTaxPostingComponent[];
  readonly totalTaxAmount: number;
  readonly currency: string;
}

const fail = (code: PurchasePostingDomainErrorCode, field: string): never => {
  throw new PurchasePostingDomainError(code, field);
};

function required(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.taxPolicyInvalid, field);
  }
  return value.trim();
}

export function createPurchaseTaxPolicy(
  input: CreatePurchaseTaxPolicyInput,
): PurchaseTaxPolicy {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.taxPolicyInvalid, "policy");
  }
  if (!PURCHASE_TAX_RECOVERABILITY.includes(input.recoverability)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.taxPolicyInvalid, "policy.recoverability");
  }
  return Object.freeze({
    policyId: required(input.policyId, "policy.policyId"),
    companyId: required(input.companyId, "policy.companyId"),
    recoverability: input.recoverability,
  });
}

function taxComponent(
  line: PurchasePostingLineFactSnapshot,
  policy: PurchaseTaxPolicy,
): PurchaseTaxPostingComponent | null {
  if (line.amounts.taxAmount === 0) return null;

  if (policy.recoverability === "recoverable") {
    return Object.freeze({
      componentId: `tax:${line.purchaseLineId}`,
      purchaseLineId: line.purchaseLineId,
      taxAmount: line.amounts.taxAmount,
      currency: line.amounts.currency,
      recoverability: policy.recoverability,
      destination: "input-vat-recoverable",
      side: "debit",
      accountRole: "input-vat-recoverable",
      deferredToStep: null,
    });
  }

  if (line.lineKind === "stock-product") {
    return Object.freeze({
      componentId: `tax:${line.purchaseLineId}`,
      purchaseLineId: line.purchaseLineId,
      taxAmount: line.amounts.taxAmount,
      currency: line.amounts.currency,
      recoverability: policy.recoverability,
      destination: "inventory-capitalizable-cost",
      side: "debit",
      accountRole: "inventory-asset",
      deferredToStep: 12,
    });
  }

  return Object.freeze({
    componentId: `tax:${line.purchaseLineId}`,
    purchaseLineId: line.purchaseLineId,
    taxAmount: line.amounts.taxAmount,
    currency: line.amounts.currency,
    recoverability: policy.recoverability,
    destination: "purchase-expense",
    side: "debit",
    accountRole: "purchase-expense",
    deferredToStep: null,
  });
}

export function createPurchaseTaxPostingPlan(
  fact: PurchasePostingFactSnapshot,
  policyInput: CreatePurchaseTaxPolicyInput,
): PurchaseTaxPostingPlan {
  if (typeof fact !== "object" || fact === null || Array.isArray(fact)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.taxPostingInvalid, "fact");
  }

  createSupplierInvoicePostingPlan(fact);
  const policy = createPurchaseTaxPolicy(policyInput);

  if (policy.companyId !== fact.companyId) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.scopeMismatch, "policy.companyId");
  }

  const components = fact.lines
    .map(line => taxComponent(line, policy))
    .filter((component): component is PurchaseTaxPostingComponent => component !== null);

  let totalTaxAmount = 0;
  for (const component of components) {
    totalTaxAmount += component.taxAmount;
    if (!Number.isSafeInteger(totalTaxAmount)) {
      return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.taxPostingInvalid, "totalTaxAmount");
    }
  }

  if (totalTaxAmount !== fact.totals.taxAmount) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.taxPostingInvalid, "totalTaxAmount");
  }

  return Object.freeze({
    factId: fact.factId,
    purchaseDocumentId: fact.purchaseDocumentId,
    policyId: policy.policyId,
    components: Object.freeze(components),
    totalTaxAmount,
    currency: fact.totals.currency,
  });
}
