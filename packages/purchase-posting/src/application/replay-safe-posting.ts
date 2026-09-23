import type { JournalVoucher } from "@argin/accounting/journal";

import {
  preparePurchasePosting,
} from "../domain/purchase-posting.ts";
import type {
  PurchasePostingAggregate,
} from "../domain/purchase-posting.ts";
import {
  createPurchasePostingIdempotencyIdentity,
  createPurchasePostingIdempotencyKey,
  createPurchasePostingIdempotencyRecord,
  assertPurchasePostingReplayCompatible,
} from "../domain/purchase-posting-idempotency.ts";
import type {
  PurchasePostingIdempotencyRecord,
  PurchasePostingPurpose,
} from "../domain/purchase-posting-idempotency.ts";
import type {
  PurchasePostingSourceIdentity,
} from "../domain/purchase-posting-source-reference.ts";
import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
} from "../domain/purchase-posting-domain-errors.ts";
import type {
  PurchasePostingDomainErrorCode,
} from "../domain/purchase-posting-domain-errors.ts";

export interface PurchasePostingReplaySession {
  findIdempotencyRecord(idempotencyKey: string): Promise<PurchasePostingIdempotencyRecord | null>;
  findPreparedPosting(postingId: string): Promise<PurchasePostingAggregate | null>;
  findJournalDraft(journalVoucherId: string): Promise<JournalVoucher | null>;
  createJournalDraft(voucher: JournalVoucher): Promise<void>;
  savePreparedPosting(posting: PurchasePostingAggregate, expectedVersion: number): Promise<void>;
  saveIdempotencyRecord(record: PurchasePostingIdempotencyRecord): Promise<void>;
}

export interface PurchasePostingReplayUnitOfWork {
  run<T>(work: (session: PurchasePostingReplaySession) => Promise<T>): Promise<T>;
}

export interface ReplaySafePurchasePostingInput {
  readonly posting: PurchasePostingAggregate;
  readonly journal: JournalVoucher;
  readonly source: PurchasePostingSourceIdentity;
  readonly purpose: PurchasePostingPurpose;
  readonly payloadFingerprint: string;
  readonly expectedPostingVersion: number;
  readonly occurredAt: string;
}

export interface ReplaySafePurchasePostingResult {
  readonly posting: PurchasePostingAggregate;
  readonly journal: JournalVoucher;
  readonly replayed: boolean;
  readonly idempotencyRecord: PurchasePostingIdempotencyRecord;
}

const fail = (code: PurchasePostingDomainErrorCode, field: string): never => {
  throw new PurchasePostingDomainError(code, field);
};

function assertDraftScope(input: ReplaySafePurchasePostingInput): void {
  if (
    input.journal.status !== "draft"
    || input.journal.companyId !== input.posting.companyId
    || input.journal.branchId !== input.posting.branchId
    || input.source.companyId !== input.posting.companyId
    || input.source.branchId !== input.posting.branchId
    || input.journal.source.type !== "source_document"
    || input.journal.source.sourceId !== input.source.sourceId
  ) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.idempotencyInvalid, "scope");
  }
  if (
    input.journal.totalDebit.amount <= 0
    || input.journal.totalDebit.amount !== input.journal.totalCredit.amount
    || input.journal.totalDebit.currency !== input.journal.totalCredit.currency
  ) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.atomicPostingJournalInvalid, "journal.balance");
  }
}

async function replay(
  session: PurchasePostingReplaySession,
  record: PurchasePostingIdempotencyRecord,
): Promise<ReplaySafePurchasePostingResult> {
  const [posting, journal] = await Promise.all([
    session.findPreparedPosting(record.postingId),
    session.findJournalDraft(record.journalVoucherId),
  ]);

  if (
    posting === null
    || journal === null
    || posting.journalVoucherId !== record.journalVoucherId
    || posting.version !== record.committedPostingVersion
    || posting.status !== "prepared"
    || journal.id !== record.journalVoucherId
  ) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.replayOutcomeInvalid, "storedOutcome");
  }

  return Object.freeze({
    posting,
    journal,
    replayed: true,
    idempotencyRecord: record,
  });
}

export async function commitPurchasePostingReplaySafe(
  input: ReplaySafePurchasePostingInput,
  unitOfWork: PurchasePostingReplayUnitOfWork,
): Promise<ReplaySafePurchasePostingResult> {
  if (!unitOfWork || typeof unitOfWork.run !== "function") {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.idempotencyInvalid, "unitOfWork");
  }

  assertDraftScope(input);

  const identity = createPurchasePostingIdempotencyIdentity({
    source: input.source,
    purpose: input.purpose,
    payloadFingerprint: input.payloadFingerprint,
  });
  const idempotencyKey = createPurchasePostingIdempotencyKey(
    identity.source,
    identity.purpose,
  );

  return unitOfWork.run(async (session) => {
    const existing = await session.findIdempotencyRecord(idempotencyKey);
    if (existing !== null) {
      assertPurchasePostingReplayCompatible(existing, identity);
      return replay(session, existing);
    }

    if (input.posting.version !== input.expectedPostingVersion) {
      return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.versionInvalid, "expectedPostingVersion");
    }

    const prepared = preparePurchasePosting(input.posting, {
      journalVoucherId: input.journal.id,
      expectedVersion: input.expectedPostingVersion,
      occurredAt: input.occurredAt,
    });

    const record = createPurchasePostingIdempotencyRecord({
      idempotencyKey,
      source: identity.source,
      purpose: identity.purpose,
      payloadFingerprint: identity.payloadFingerprint,
      postingId: prepared.postingId,
      journalVoucherId: input.journal.id,
      committedPostingVersion: prepared.version,
      committedAt: input.occurredAt,
    });

    await session.createJournalDraft(input.journal);
    await session.savePreparedPosting(prepared, input.expectedPostingVersion);
    await session.saveIdempotencyRecord(record);

    return Object.freeze({
      posting: prepared,
      journal: input.journal,
      replayed: false,
      idempotencyRecord: record,
    });
  });
}
