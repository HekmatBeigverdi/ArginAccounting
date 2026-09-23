import type { JournalVoucher } from "@argin/accounting/journal";

import {
  preparePurchasePosting,
} from "../domain/purchase-posting.ts";
import type {
  PurchasePostingAggregate,
} from "../domain/purchase-posting.ts";
import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
} from "../domain/purchase-posting-domain-errors.ts";
import type {
  PurchasePostingDomainErrorCode,
} from "../domain/purchase-posting-domain-errors.ts";
import {
  assertNewJournalDraftVersion,
  assertPurchasePostingConcurrency,
} from "../domain/posting-concurrency.ts";

export interface PurchasePostingAtomicSession {
  findPosting(postingId: string): Promise<PurchasePostingAggregate | null>;
  createJournalDraft(voucher: JournalVoucher): Promise<void>;
  savePreparedPosting(
    posting: PurchasePostingAggregate,
    expectedVersion: number,
  ): Promise<void>;
}

export interface PurchasePostingAtomicUnitOfWork {
  run<T>(work: (session: PurchasePostingAtomicSession) => Promise<T>): Promise<T>;
}

export interface CommitPurchasePostingJournalDraftInput {
  readonly posting: PurchasePostingAggregate;
  readonly journal: JournalVoucher;
  readonly expectedPostingVersion: number;
  readonly occurredAt: string;
}

export interface CommitPurchasePostingJournalDraftResult {
  readonly posting: PurchasePostingAggregate;
  readonly journal: JournalVoucher;
}

const fail = (code: PurchasePostingDomainErrorCode, field: string): never => {
  throw new PurchasePostingDomainError(code, field);
};

function assertJournalDraft(
  posting: PurchasePostingAggregate,
  journal: JournalVoucher,
): void {
  if (journal.status !== "draft") {
    return fail(
      PURCHASE_POSTING_DOMAIN_ERROR_CODES.atomicPostingJournalInvalid,
      "journal.status",
    );
  }

  if (
    journal.companyId !== posting.companyId
    || journal.branchId !== posting.branchId
  ) {
    return fail(
      PURCHASE_POSTING_DOMAIN_ERROR_CODES.atomicPostingScopeMismatch,
      "journal.scope",
    );
  }

  if (
    journal.source.type !== "source_document"
    || journal.source.sourceId === null
  ) {
    return fail(
      PURCHASE_POSTING_DOMAIN_ERROR_CODES.atomicPostingJournalInvalid,
      "journal.source",
    );
  }

  if (
    journal.totalDebit.currency !== journal.totalCredit.currency
    || journal.totalDebit.amount <= 0
    || journal.totalDebit.amount !== journal.totalCredit.amount
    || journal.lines.length < 2
  ) {
    return fail(
      PURCHASE_POSTING_DOMAIN_ERROR_CODES.atomicPostingJournalInvalid,
      "journal.balance",
    );
  }
}

export async function commitPurchasePostingJournalDraftAtomically(
  input: CommitPurchasePostingJournalDraftInput,
  unitOfWork: PurchasePostingAtomicUnitOfWork,
): Promise<CommitPurchasePostingJournalDraftResult> {
  if (
    typeof input !== "object"
    || input === null
    || typeof unitOfWork !== "object"
    || unitOfWork === null
    || typeof unitOfWork.run !== "function"
  ) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.atomicPostingInvalid, "input");
  }

  assertJournalDraft(input.posting, input.journal);
  assertNewJournalDraftVersion(input.journal);

  return unitOfWork.run(async (session) => {
    if (
      !session
      || typeof session.findPosting !== "function"
      || typeof session.createJournalDraft !== "function"
      || typeof session.savePreparedPosting !== "function"
    ) {
      return fail(
        PURCHASE_POSTING_DOMAIN_ERROR_CODES.atomicPostingInvalid,
        "unitOfWork.session",
      );
    }

    const current = await session.findPosting(input.posting.postingId);
    if (current === null) {
      return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.concurrencyPostingMissing, "posting");
    }

    assertPurchasePostingConcurrency(current, {
      postingId: input.posting.postingId,
      companyId: input.posting.companyId,
      branchId: input.posting.branchId,
      expectedPostingVersion: input.expectedPostingVersion,
    });

    const prepared = preparePurchasePosting(current, {
      journalVoucherId: input.journal.id,
      expectedVersion: input.expectedPostingVersion,
      occurredAt: input.occurredAt,
    });

    await session.createJournalDraft(input.journal);
    await session.savePreparedPosting(prepared, input.expectedPostingVersion);

    return Object.freeze({
      posting: prepared,
      journal: input.journal,
    });
  });
}
