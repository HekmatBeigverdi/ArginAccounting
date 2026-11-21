import type {
  JournalVoucher,
} from "@argin/accounting/journal";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./sales-posting-domain-errors.ts";
import type {
  SalesPostingDomainErrorCode,
} from "./sales-posting-domain-errors.ts";
import type {
  SalesPostingSourceIdentity,
} from "./sales-posting-source.ts";

export interface SalesJournalLineProvenance {
  readonly journalLineId: string;
  readonly componentId: string;
  readonly role:
    | "accounts-receivable"
    | "sales-revenue"
    | "output-vat"
    | "cogs"
    | "inventory-asset";
  readonly salesLineId: string | null;
  readonly customerPartyId: string | null;
  readonly productId: string | null;
  readonly inventoryDocumentId: string | null;
  readonly inventoryLineId: string | null;
  readonly movementId: string | null;
  readonly valuationEntryId: string | null;
  readonly valuationMethod: "fifo" | "moving_average" | null;
  readonly valuationRevision: number | null;
  readonly originalInvoiceId: string | null;
  readonly originalInvoiceLineId: string | null;
  readonly taxIds: readonly string[];
  readonly taxCodes: readonly string[];
}

export interface SalesPostingJournalProvenance {
  readonly journalVoucherId: string;
  readonly postingId: string;
  readonly source: SalesPostingSourceIdentity;
  readonly lineProvenance: readonly SalesJournalLineProvenance[];
  readonly createdAtUtc: string;
}

const fail = (code: SalesPostingDomainErrorCode, field: string): never => {
  throw new SalesPostingDomainError(code, field);
};

function required(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.journalProvenanceInvalid,
      field,
    );
  }
  return value.trim();
}

function optional(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

export function createSalesPostingJournalProvenance(input: {
  readonly journal: JournalVoucher;
  readonly postingId: string;
  readonly source: SalesPostingSourceIdentity;
  readonly lineProvenance: readonly SalesJournalLineProvenance[];
  readonly createdAtUtc: string;
}): SalesPostingJournalProvenance {
  if (
    !input
    || typeof input !== "object"
    || !input.journal
    || !Array.isArray(input.lineProvenance)
    || input.lineProvenance.length !== input.journal.lines.length
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.journalProvenanceInvalid,
      "input",
    );
  }

  const journalLineIds = new Set<string>(
    input.journal.lines.map((line) => String(line.id)),
  );
  const seen = new Set<string>();

  const lineProvenance = input.lineProvenance.map((raw) => {
    const journalLineId = required(raw.journalLineId, "journalLineId");
    if (!journalLineIds.has(journalLineId) || seen.has(journalLineId)) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.journalProvenanceInvalid,
        "journalLineId",
      );
    }
    seen.add(journalLineId);

    if (
      raw.valuationRevision !== null
      && (!Number.isSafeInteger(raw.valuationRevision) || raw.valuationRevision < 1)
    ) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.journalProvenanceInvalid,
        "valuationRevision",
      );
    }

    if (
      raw.valuationEntryId !== null
      && (
        raw.movementId === null
        || raw.productId === null
        || raw.valuationMethod === null
        || raw.valuationRevision === null
      )
    ) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.journalProvenanceInvalid,
        "valuation",
      );
    }

    return Object.freeze({
      journalLineId,
      componentId: required(raw.componentId, "componentId"),
      role: raw.role,
      salesLineId: optional(raw.salesLineId),
      customerPartyId: optional(raw.customerPartyId),
      productId: optional(raw.productId),
      inventoryDocumentId: optional(raw.inventoryDocumentId),
      inventoryLineId: optional(raw.inventoryLineId),
      movementId: optional(raw.movementId),
      valuationEntryId: optional(raw.valuationEntryId),
      valuationMethod: raw.valuationMethod,
      valuationRevision: raw.valuationRevision,
      originalInvoiceId: optional(raw.originalInvoiceId),
      originalInvoiceLineId: optional(raw.originalInvoiceLineId),
      taxIds: Object.freeze([...raw.taxIds]),
      taxCodes: Object.freeze([...raw.taxCodes]),
    });
  });

  if (seen.size !== input.journal.lines.length) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.journalProvenanceInvalid,
      "lineProvenance",
    );
  }

  const parsed = new Date(input.createdAtUtc);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== input.createdAtUtc) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.journalProvenanceInvalid,
      "createdAtUtc",
    );
  }

  return Object.freeze({
    journalVoucherId: input.journal.id,
    postingId: required(input.postingId, "postingId"),
    source: input.source,
    lineProvenance: Object.freeze(lineProvenance),
    createdAtUtc: input.createdAtUtc,
  });
}
