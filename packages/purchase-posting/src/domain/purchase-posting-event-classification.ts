import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
} from "./purchase-posting-domain-errors.ts";
import type { PurchasePostingDomainErrorCode } from "./purchase-posting-domain-errors.ts";
import {
  PURCHASE_POSTING_SOURCE_DOCUMENT_TYPES,
  PURCHASE_POSTING_SOURCE_STATUSES,
} from "./purchase-posting-facts.ts";
import type {
  PurchasePostingFactSnapshot,
  PurchasePostingSourceDocumentType,
  PurchasePostingSourceStatus,
} from "./purchase-posting-facts.ts";

export const PURCHASE_POSTING_EVENT_DISPOSITIONS = Object.freeze([
  "posting",
  "non-posting",
  "ineligible",
] as const);

export type PurchasePostingEventDisposition =
  (typeof PURCHASE_POSTING_EVENT_DISPOSITIONS)[number];

export const PURCHASE_POSTING_EVENT_KINDS = Object.freeze([
  "supplier-invoice-recognition",
  "purchase-return-recognition",
  "purchase-correction-recognition",
  "none",
] as const);

export type PurchasePostingEventKind =
  (typeof PURCHASE_POSTING_EVENT_KINDS)[number];

export const PURCHASE_POSTING_EVENT_REASON_CODES = Object.freeze([
  "supplier_invoice_confirmed",
  "purchase_return_confirmed",
  "purchase_correction_confirmed",
  "purchase_order_has_no_accounting_effect",
  "supplier_invoice_compensated_by_return_document",
  "supplier_invoice_compensated_by_correction_document",
  "compensating_document_must_be_confirmed",
] as const);

export type PurchasePostingEventReasonCode =
  (typeof PURCHASE_POSTING_EVENT_REASON_CODES)[number];

export interface PurchasePostingEventClassification {
  readonly documentType: PurchasePostingSourceDocumentType;
  readonly sourceStatus: PurchasePostingSourceStatus;
  readonly disposition: PurchasePostingEventDisposition;
  readonly eventKind: PurchasePostingEventKind;
  readonly reasonCode: PurchasePostingEventReasonCode;
  readonly requiresJournalPosting: boolean;
}

export interface ClassifyPurchasePostingEventInput {
  readonly documentType: PurchasePostingSourceDocumentType;
  readonly sourceStatus: PurchasePostingSourceStatus;
}

const fail = (code: PurchasePostingDomainErrorCode, field: string): never => {
  throw new PurchasePostingDomainError(code, field);
};

function result(
  documentType: PurchasePostingSourceDocumentType,
  sourceStatus: PurchasePostingSourceStatus,
  disposition: PurchasePostingEventDisposition,
  eventKind: PurchasePostingEventKind,
  reasonCode: PurchasePostingEventReasonCode,
): PurchasePostingEventClassification {
  return Object.freeze({
    documentType,
    sourceStatus,
    disposition,
    eventKind,
    reasonCode,
    requiresJournalPosting: disposition === "posting",
  });
}

export function classifyPurchasePostingEvent(
  input: ClassifyPurchasePostingEventInput,
): PurchasePostingEventClassification {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.eventClassificationInvalid, "input");
  }
  if (!PURCHASE_POSTING_SOURCE_DOCUMENT_TYPES.includes(input.documentType)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.documentTypeInvalid, "documentType");
  }
  if (!PURCHASE_POSTING_SOURCE_STATUSES.includes(input.sourceStatus)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.sourceStatusInvalid, "sourceStatus");
  }

  if (input.documentType === "purchase-order") {
    return result(
      input.documentType,
      input.sourceStatus,
      "non-posting",
      "none",
      "purchase_order_has_no_accounting_effect",
    );
  }

  if (input.documentType === "supplier-invoice") {
    if (input.sourceStatus === "confirmed") {
      return result(
        input.documentType,
        input.sourceStatus,
        "posting",
        "supplier-invoice-recognition",
        "supplier_invoice_confirmed",
      );
    }
    if (input.sourceStatus === "returned") {
      return result(
        input.documentType,
        input.sourceStatus,
        "non-posting",
        "none",
        "supplier_invoice_compensated_by_return_document",
      );
    }
    return result(
      input.documentType,
      input.sourceStatus,
      "non-posting",
      "none",
      "supplier_invoice_compensated_by_correction_document",
    );
  }

  if (input.documentType === "purchase-return") {
    if (input.sourceStatus === "confirmed") {
      return result(
        input.documentType,
        input.sourceStatus,
        "posting",
        "purchase-return-recognition",
        "purchase_return_confirmed",
      );
    }
    return result(
      input.documentType,
      input.sourceStatus,
      "ineligible",
      "none",
      "compensating_document_must_be_confirmed",
    );
  }

  if (input.sourceStatus === "confirmed") {
    return result(
      input.documentType,
      input.sourceStatus,
      "posting",
      "purchase-correction-recognition",
      "purchase_correction_confirmed",
    );
  }
  return result(
    input.documentType,
    input.sourceStatus,
    "ineligible",
    "none",
    "compensating_document_must_be_confirmed",
  );
}

export function classifyPurchasePostingFact(
  fact: PurchasePostingFactSnapshot,
): PurchasePostingEventClassification {
  if (typeof fact !== "object" || fact === null || Array.isArray(fact)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.eventClassificationInvalid, "fact");
  }
  return classifyPurchasePostingEvent({
    documentType: fact.documentType,
    sourceStatus: fact.sourceStatus,
  });
}

export function isPurchasePostingEventEligible(
  classification: PurchasePostingEventClassification,
): boolean {
  return classification.disposition === "posting";
}
