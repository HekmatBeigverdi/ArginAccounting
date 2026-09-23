import type { JournalVoucher } from "@argin/accounting/journal";

import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
} from "./purchase-posting-domain-errors.ts";
import type { PurchasePostingDomainErrorCode } from "./purchase-posting-domain-errors.ts";
import type { PurchasePostingAggregate } from "./purchase-posting.ts";
import {
  createPurchasePostingSourceIdentity,
} from "./purchase-posting-source-reference.ts";
import type {
  PurchasePostingSourceIdentity,
} from "./purchase-posting-source-reference.ts";

export interface PurchasePostingConcurrencyExpectation {
  readonly postingId: string;
  readonly expectedPostingVersion: number;
  readonly source: PurchasePostingSourceIdentity;
}

const fail = (code: PurchasePostingDomainErrorCode, field: string): never => {
  throw new PurchasePostingDomainError(code, field);
};

export function assertPurchasePostingConcurrency(
  current: PurchasePostingAggregate,
  expectation: PurchasePostingConcurrencyExpectation,
): void {
  if (current.postingId !== expectation.postingId) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.concurrencyStateMismatch, "postingId");
  }
  if (current.version !== expectation.expectedPostingVersion) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.concurrencyConflict, "expectedPostingVersion");
  }
  if (current.status !== "draft" || current.journalVoucherId !== null) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.concurrencyStateMismatch, "posting.status");
  }

  const source = createPurchasePostingSourceIdentity(expectation.source);
  if (
    current.companyId !== source.companyId
    || current.branchId !== source.branchId
  ) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.concurrencyStateMismatch, "source.scope");
  }
}

export function assertNewJournalDraftVersion(
  journal: JournalVoucher,
): void {
  if (journal.status !== "draft") {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.journalVersionConflict, "journal.status");
  }
  if (journal.version !== 1) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.journalVersionConflict, "journal.version");
  }
}
