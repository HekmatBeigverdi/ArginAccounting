import {
  verifySalesCommercialSnapshot,
} from "@argin/sales";
import type {
  SalesCommercialSnapshot,
  SalesDocumentSnapshot,
  SalesDocumentTotals,
} from "@argin/sales";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./sales-posting-domain-errors.ts";
import type { SalesPostingDomainErrorCode } from "./sales-posting-domain-errors.ts";
import {
  createSalesPostingSourceIdentity,
} from "./sales-posting-source.ts";
import type { SalesPostingSourceIdentity } from "./sales-posting-source.ts";

export interface SalesCommercialPostingLineInput {
  readonly snapshotId: string;
  readonly lineId: string;
  readonly productId: string;
  readonly lineKind: SalesCommercialSnapshot["lineKind"];
  readonly capturedAt: string;
  readonly terms: SalesCommercialSnapshot["terms"];
  readonly totals: SalesCommercialSnapshot["totals"];
}

export interface SalesCommercialPostingInput {
  readonly source: SalesPostingSourceIdentity;
  readonly companyId: string;
  readonly branchId: string;
  readonly fiscalYearId: string;
  readonly customerPartyId: string;
  readonly businessDate: string;
  readonly currency: string;
  readonly documentTotals: SalesDocumentTotals;
  readonly lines: readonly SalesCommercialPostingLineInput[];
}

export interface CreateSalesCommercialPostingInputArgs {
  readonly source: SalesPostingSourceIdentity;
  readonly document: SalesDocumentSnapshot;
  readonly commercialSnapshots: readonly SalesCommercialSnapshot[];
  readonly documentTotals: SalesDocumentTotals;
}

const fail = (code: SalesPostingDomainErrorCode, field: string): never => {
  throw new SalesPostingDomainError(code, field);
};

function required(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.identityRequired, field);
  }
  return value.trim();
}

function assertDocumentSourceMatch(
  source: SalesPostingSourceIdentity,
  document: SalesDocumentSnapshot,
): void {
  if (source.sourceDocumentId !== document.documentId) {
    fail(SALES_POSTING_DOMAIN_ERROR_CODES.scopeMismatch, "source.sourceDocumentId");
  }
  if (source.sourceType !== document.documentType) {
    fail(SALES_POSTING_DOMAIN_ERROR_CODES.sourceTypeInvalid, "source.sourceType");
  }
}

function assertSnapshotMatchesLine(
  snapshot: SalesCommercialSnapshot,
  document: SalesDocumentSnapshot,
): void {
  const line = document.lines.find((candidate) => candidate.lineId === snapshot.lineId);
  if (!line) {
    fail(SALES_POSTING_DOMAIN_ERROR_CODES.sourceInvalid, "commercialSnapshots.lineId");
  }
  if (line.item.productId !== snapshot.productId || line.lineKind !== snapshot.lineKind) {
    fail(SALES_POSTING_DOMAIN_ERROR_CODES.sourceInvalid, "commercialSnapshots.line");
  }
  if (!verifySalesCommercialSnapshot(snapshot)) {
    fail(SALES_POSTING_DOMAIN_ERROR_CODES.sourceInvalid, "commercialSnapshots.totals");
  }
}

function cloneLine(snapshot: SalesCommercialSnapshot): SalesCommercialPostingLineInput {
  return Object.freeze({
    snapshotId: required(snapshot.snapshotId, "commercialSnapshots.snapshotId"),
    lineId: required(snapshot.lineId, "commercialSnapshots.lineId"),
    productId: required(snapshot.productId, "commercialSnapshots.productId"),
    lineKind: snapshot.lineKind,
    capturedAt: snapshot.capturedAt,
    terms: snapshot.terms,
    totals: snapshot.totals,
  });
}

export function createSalesCommercialPostingInput(
  args: CreateSalesCommercialPostingInputArgs,
): SalesCommercialPostingInput {
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    fail(SALES_POSTING_DOMAIN_ERROR_CODES.inputInvalid, "commercialPostingInput");
  }

  const source = createSalesPostingSourceIdentity(args.source);
  const document = args.document;
  const snapshots = args.commercialSnapshots;
  const totals = args.documentTotals;

  if (!document || typeof document !== "object") {
    fail(SALES_POSTING_DOMAIN_ERROR_CODES.inputInvalid, "document");
  }
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    fail(SALES_POSTING_DOMAIN_ERROR_CODES.sourceInvalid, "commercialSnapshots");
  }
  if (document.lines.length !== snapshots.length) {
    fail(SALES_POSTING_DOMAIN_ERROR_CODES.sourceInvalid, "commercialSnapshots");
  }

  assertDocumentSourceMatch(source, document);

  const ids = new Set<string>();
  const lines = snapshots.map((snapshot) => {
    if (ids.has(snapshot.lineId)) {
      fail(SALES_POSTING_DOMAIN_ERROR_CODES.sourceInvalid, "commercialSnapshots.lineId");
    }
    ids.add(snapshot.lineId);
    assertSnapshotMatchesLine(snapshot, document);
    return cloneLine(snapshot);
  });

  const currencies = new Set(lines.map((line) => line.totals.currency));
  if (currencies.size !== 1) {
    fail(SALES_POSTING_DOMAIN_ERROR_CODES.sourceInvalid, "commercialSnapshots.currency");
  }
  const currency = lines[0]!.totals.currency;
  if (totals.currency !== currency || totals.lineCount !== lines.length) {
    fail(SALES_POSTING_DOMAIN_ERROR_CODES.sourceInvalid, "documentTotals");
  }

  const expected = {
    grossAmount: lines.reduce((sum, line) => sum + line.totals.grossAmount, 0),
    discountAmount: lines.reduce((sum, line) => sum + line.totals.discountAmount, 0),
    netAfterDiscount: lines.reduce((sum, line) => sum + line.totals.netAfterDiscount, 0),
    chargeAmount: lines.reduce((sum, line) => sum + line.totals.chargeAmount, 0),
    taxBaseAmount: lines.reduce((sum, line) => sum + line.totals.taxBaseAmount, 0),
    taxAmount: lines.reduce((sum, line) => sum + line.totals.taxAmount, 0),
    grandTotal: lines.reduce((sum, line) => sum + line.totals.grandTotal, 0),
  };
  for (const [key, value] of Object.entries(expected)) {
    if (totals[key as keyof typeof expected] !== value) {
      fail(SALES_POSTING_DOMAIN_ERROR_CODES.sourceInvalid, `documentTotals.${key}`);
    }
  }

  return Object.freeze({
    source,
    companyId: required(document.scope.companyId, "document.scope.companyId"),
    branchId: required(document.scope.branchId, "document.scope.branchId"),
    fiscalYearId: required(document.scope.fiscalYearId, "document.scope.fiscalYearId"),
    customerPartyId: required(document.customer.partyId, "document.customer.partyId"),
    businessDate: document.businessDate,
    currency,
    documentTotals: totals,
    lines: Object.freeze(lines),
  });
}
