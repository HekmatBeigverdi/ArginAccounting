import {
  PURCHASE_POSTING_LINE_KINDS,
  PURCHASE_POSTING_SOURCE_STATUSES,
} from "./purchase-posting-facts.ts";
import type {
  PurchasePostingLineKind,
  PurchasePostingSourceStatus,
} from "./purchase-posting-facts.ts";
import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
} from "./purchase-posting-domain-errors.ts";

export const PURCHASE_POSTING_MODES = Object.freeze([
  "automatic",
  "accountant-approval",
] as const);

export type PurchasePostingMode = (typeof PURCHASE_POSTING_MODES)[number];

export const PURCHASE_FULFILLMENT_STATES = Object.freeze([
  "not-required",
  "not-received",
  "partially-received",
  "fully-received",
] as const);

export type PurchaseFulfillmentState =
  (typeof PURCHASE_FULFILLMENT_STATES)[number];

export const PURCHASE_ACCOUNTING_ELIGIBILITY_STATUSES = Object.freeze([
  "blocked",
  "ready-for-automatic-posting",
  "awaiting-accountant-approval",
] as const);

export type PurchaseAccountingEligibilityStatus =
  (typeof PURCHASE_ACCOUNTING_ELIGIBILITY_STATUSES)[number];

export const PURCHASE_ACCOUNTING_ELIGIBILITY_REASON_CODES = Object.freeze([
  "source_not_confirmed",
  "stock_receipt_missing",
  "stock_receipt_partial",
  "all_required_fulfillment_complete",
] as const);

export type PurchaseAccountingEligibilityReasonCode =
  (typeof PURCHASE_ACCOUNTING_ELIGIBILITY_REASON_CODES)[number];

export interface PurchaseFulfillmentAccountingPolicy {
  readonly postingMode: PurchasePostingMode;
  readonly stockReceiptRequirement: "full-receipt-before-posting";
  readonly nonStockReceiptRequirement: "not-required";
  readonly serviceReceiptRequirement: "not-required";
}

export interface PurchaseFulfillmentLineState {
  readonly purchaseLineId: string;
  readonly lineKind: PurchasePostingLineKind;
  readonly fulfillmentState: PurchaseFulfillmentState;
}

export interface EvaluateSupplierInvoiceAccountingEligibilityInput {
  readonly sourceStatus: PurchasePostingSourceStatus;
  readonly policy: PurchaseFulfillmentAccountingPolicy;
  readonly lines: readonly PurchaseFulfillmentLineState[];
}

export interface PurchaseAccountingEligibilityLineResult {
  readonly purchaseLineId: string;
  readonly lineKind: PurchasePostingLineKind;
  readonly fulfillmentState: PurchaseFulfillmentState;
  readonly receiptRequired: boolean;
  readonly ready: boolean;
  readonly reasonCode:
    | "stock_receipt_missing"
    | "stock_receipt_partial"
    | "all_required_fulfillment_complete";
}

export interface PurchaseAccountingEligibilityResult {
  readonly status: PurchaseAccountingEligibilityStatus;
  readonly reasonCode: PurchaseAccountingEligibilityReasonCode;
  readonly requiresAccountantApproval: boolean;
  readonly shouldPostAutomatically: boolean;
  readonly lines: readonly PurchaseAccountingEligibilityLineResult[];
}

const fail = (field: string): never => {
  throw new PurchasePostingDomainError(
    PURCHASE_POSTING_DOMAIN_ERROR_CODES.inputInvalid,
    field,
  );
};

function requiredIdentity(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(field);
  }
  return value.trim();
}

export function createPurchaseFulfillmentAccountingPolicy(
  postingMode: PurchasePostingMode,
): PurchaseFulfillmentAccountingPolicy {
  if (!PURCHASE_POSTING_MODES.includes(postingMode)) {
    return fail("postingMode");
  }
  return Object.freeze({
    postingMode,
    stockReceiptRequirement: "full-receipt-before-posting",
    nonStockReceiptRequirement: "not-required",
    serviceReceiptRequirement: "not-required",
  });
}

function evaluateLine(
  line: PurchaseFulfillmentLineState,
): PurchaseAccountingEligibilityLineResult {
  if (!line || typeof line !== "object") {
    return fail("lines");
  }
  const purchaseLineId = requiredIdentity(line.purchaseLineId, "lines.purchaseLineId");
  if (!PURCHASE_POSTING_LINE_KINDS.includes(line.lineKind)) {
    return fail("lines.lineKind");
  }
  if (!PURCHASE_FULFILLMENT_STATES.includes(line.fulfillmentState)) {
    return fail("lines.fulfillmentState");
  }

  if (line.lineKind !== "stock-product") {
    if (line.fulfillmentState !== "not-required") {
      return fail("lines.fulfillmentState");
    }
    return Object.freeze({
      purchaseLineId,
      lineKind: line.lineKind,
      fulfillmentState: line.fulfillmentState,
      receiptRequired: false,
      ready: true,
      reasonCode: "all_required_fulfillment_complete",
    });
  }

  if (line.fulfillmentState === "not-required") {
    return fail("lines.fulfillmentState");
  }
  if (line.fulfillmentState === "not-received") {
    return Object.freeze({
      purchaseLineId,
      lineKind: line.lineKind,
      fulfillmentState: line.fulfillmentState,
      receiptRequired: true,
      ready: false,
      reasonCode: "stock_receipt_missing",
    });
  }
  if (line.fulfillmentState === "partially-received") {
    return Object.freeze({
      purchaseLineId,
      lineKind: line.lineKind,
      fulfillmentState: line.fulfillmentState,
      receiptRequired: true,
      ready: false,
      reasonCode: "stock_receipt_partial",
    });
  }
  return Object.freeze({
    purchaseLineId,
    lineKind: line.lineKind,
    fulfillmentState: line.fulfillmentState,
    receiptRequired: true,
    ready: true,
    reasonCode: "all_required_fulfillment_complete",
  });
}

export function evaluateSupplierInvoiceAccountingEligibility(
  input: EvaluateSupplierInvoiceAccountingEligibilityInput,
): PurchaseAccountingEligibilityResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("input");
  }
  if (!PURCHASE_POSTING_SOURCE_STATUSES.includes(input.sourceStatus)) {
    return fail("sourceStatus");
  }
  if (
    !input.policy ||
    !PURCHASE_POSTING_MODES.includes(input.policy.postingMode) ||
    input.policy.stockReceiptRequirement !== "full-receipt-before-posting" ||
    input.policy.nonStockReceiptRequirement !== "not-required" ||
    input.policy.serviceReceiptRequirement !== "not-required"
  ) {
    return fail("policy");
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    return fail("lines");
  }

  const lineIds = new Set<string>();
  const lines = input.lines.map((line) => {
    const result = evaluateLine(line);
    if (lineIds.has(result.purchaseLineId)) {
      return fail("lines.purchaseLineId");
    }
    lineIds.add(result.purchaseLineId);
    return result;
  });

  if (input.sourceStatus !== "confirmed") {
    return Object.freeze({
      status: "blocked",
      reasonCode: "source_not_confirmed",
      requiresAccountantApproval: false,
      shouldPostAutomatically: false,
      lines: Object.freeze(lines),
    });
  }

  const blockedLine = lines.find((line) => !line.ready);
  if (blockedLine) {
    return Object.freeze({
      status: "blocked",
      reasonCode: blockedLine.reasonCode,
      requiresAccountantApproval: false,
      shouldPostAutomatically: false,
      lines: Object.freeze(lines),
    });
  }

  const accountantApproval = input.policy.postingMode === "accountant-approval";
  return Object.freeze({
    status: accountantApproval
      ? "awaiting-accountant-approval"
      : "ready-for-automatic-posting",
    reasonCode: "all_required_fulfillment_complete",
    requiresAccountantApproval: accountantApproval,
    shouldPostAutomatically: !accountantApproval,
    lines: Object.freeze(lines),
  });
}
