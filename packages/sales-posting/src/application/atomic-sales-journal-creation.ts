import type {
  JournalVoucher,
} from "@argin/accounting/journal";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "../domain/sales-posting-domain-errors.ts";
import {
  applySalesPostingCompareAndSwap,
} from "../domain/sales-posting-concurrency.ts";
import type {
  SalesPostingAggregate,
} from "../domain/sales-posting.ts";
import {
  assertSalesPostingReplayCompatible,
  createSalesPostingIdempotencyIdentity,
  createSalesPostingIdempotencyKey,
  createSalesPostingIdempotencyRecord,
} from "../domain/sales-posting-idempotency.ts";
import type {
  SalesPostingIdempotencyRecord,
  SalesPostingPurpose,
} from "../domain/sales-posting-idempotency.ts";
import {
  createSalesPostingJournalDraft,
} from "../domain/sales-journal-draft.ts";
import type {
  CreateSalesPostingJournalDraftInput,
  SalesPostingJournalComponent,
} from "../domain/sales-journal-draft.ts";
import type {
  SalesPostingJournalProvenance,
} from "../domain/sales-journal-provenance.ts";
import type {
  SalesPostingOutboxEvent,
} from "./atomic-posting-unit-of-work.ts";

export interface SalesPostingJournalAtomicSession {
  findIdempotencyRecord(
    idempotencyKey: string,
  ): Promise<SalesPostingIdempotencyRecord | null>;
  findPosting(postingId: string): Promise<SalesPostingAggregate | null>;
  findJournalVoucher(journalVoucherId: string): Promise<JournalVoucher | null>;
  findJournalProvenance(
    journalVoucherId: string,
  ): Promise<SalesPostingJournalProvenance | null>;
  createJournalDraft(journal: JournalVoucher): Promise<void>;
  savePostingCas(
    posting: SalesPostingAggregate,
    expectedVersion: number,
  ): Promise<boolean>;
  saveIdempotencyRecord(
    record: SalesPostingIdempotencyRecord,
  ): Promise<void>;
  saveJournalProvenance(
    provenance: SalesPostingJournalProvenance,
  ): Promise<void>;
  appendOutboxEvent(event: SalesPostingOutboxEvent): Promise<void>;
}

export interface SalesPostingJournalAtomicUnitOfWork {
  run<T>(
    work: (session: SalesPostingJournalAtomicSession) => Promise<T>,
  ): Promise<T>;
}

export interface CommitSalesPostingJournalInput
  extends Omit<
    CreateSalesPostingJournalDraftInput,
    "components" | "requestId"
  > {
  readonly components: readonly SalesPostingJournalComponent[];
  readonly purpose: SalesPostingPurpose;
  readonly payloadFingerprint: string;
  readonly expectedPostingVersion: number;
  readonly outboxEventId: string;
  readonly requestId?: string | null;
}

export interface CommitSalesPostingJournalResult {
  readonly replayed: boolean;
  readonly posting: SalesPostingAggregate;
  readonly journal: JournalVoucher;
  readonly provenance: SalesPostingJournalProvenance;
  readonly idempotencyRecord: SalesPostingIdempotencyRecord;
  readonly outboxEvent: SalesPostingOutboxEvent | null;
}

function required(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SalesPostingDomainError(
      SALES_POSTING_DOMAIN_ERROR_CODES.atomicCommitInvalid,
      field,
    );
  }
  return value.trim();
}

export async function commitSalesPostingJournalAtomic(
  input: CommitSalesPostingJournalInput,
  unitOfWork: SalesPostingJournalAtomicUnitOfWork,
): Promise<CommitSalesPostingJournalResult> {
  if (!unitOfWork || typeof unitOfWork.run !== "function") {
    throw new SalesPostingDomainError(
      SALES_POSTING_DOMAIN_ERROR_CODES.atomicCommitInvalid,
      "unitOfWork",
    );
  }

  const identity = createSalesPostingIdempotencyIdentity({
    source: input.source,
    purpose: input.purpose,
    payloadFingerprint: input.payloadFingerprint,
  });
  const key = createSalesPostingIdempotencyKey(
    identity.source,
    identity.purpose,
  );

  return unitOfWork.run(async (session) => {
    const existing = await session.findIdempotencyRecord(key);
    if (existing !== null) {
      assertSalesPostingReplayCompatible(existing, identity);

      const [posting, journal, provenance] = await Promise.all([
        session.findPosting(existing.postingId),
        session.findJournalVoucher(existing.journalVoucherId),
        session.findJournalProvenance(existing.journalVoucherId),
      ]);
      if (
        posting === null
        || journal === null
        || provenance === null
        || journal.id !== existing.journalVoucherId
        || provenance.journalVoucherId !== journal.id
        || provenance.postingId !== posting.postingId
        || posting.version < existing.committedPostingVersion
      ) {
        throw new SalesPostingDomainError(
          SALES_POSTING_DOMAIN_ERROR_CODES.replayOutcomeInvalid,
          "storedJournalOutcome",
        );
      }

      return Object.freeze({
        replayed: true,
        posting,
        journal,
        provenance,
        idempotencyRecord: existing,
        outboxEvent: null,
      });
    }

    const current = await session.findPosting(input.postingId);
    if (current === null) {
      throw new SalesPostingDomainError(
        SALES_POSTING_DOMAIN_ERROR_CODES.concurrencyStateMismatch,
        "posting",
      );
    }

    const next = applySalesPostingCompareAndSwap(
      current,
      {
        postingId: input.postingId,
        companyId: input.companyId,
        branchId: input.branchId ?? "",
        source: identity.source,
        expectedPostingVersion: input.expectedPostingVersion,
      },
      input.createdAtUtc,
    );

    const draft = createSalesPostingJournalDraft({
      journalVoucherId: input.journalVoucherId,
      journalNumber: input.journalNumber,
      postingId: input.postingId,
      source: identity.source,
      companyId: input.companyId,
      branchId: input.branchId,
      voucherDate: input.voucherDate,
      fiscalYearId: input.fiscalYearId,
      fiscalPeriodId: input.fiscalPeriodId,
      createdAtUtc: input.createdAtUtc,
      components: input.components,
      requestId: input.requestId ?? key,
      causationId: input.causationId,
    });

    const saved = await session.savePostingCas(
      next,
      input.expectedPostingVersion,
    );
    if (!saved) {
      throw new SalesPostingDomainError(
        SALES_POSTING_DOMAIN_ERROR_CODES.atomicCommitConflict,
        "posting.version",
      );
    }

    await session.createJournalDraft(draft.journal);
    await session.saveJournalProvenance(draft.provenance);

    const record = createSalesPostingIdempotencyRecord({
      idempotencyKey: key,
      source: identity.source,
      purpose: identity.purpose,
      payloadFingerprint: identity.payloadFingerprint,
      postingId: next.postingId,
      journalVoucherId: draft.journal.id,
      committedPostingVersion: next.version,
      committedAtUtc: input.createdAtUtc,
    });
    await session.saveIdempotencyRecord(record);

    const event: SalesPostingOutboxEvent = Object.freeze({
      eventId: required(input.outboxEventId, "outboxEventId"),
      eventType: "sales-posting.accounting-recognition.committed",
      aggregateType: "sales-posting",
      aggregateId: next.postingId,
      companyId: next.companyId,
      sourceDocumentId: next.source.sourceDocumentId,
      sourceVersion: next.source.sourceVersion,
      postingVersion: next.version,
      journalVoucherId: draft.journal.id,
      occurredAtUtc: input.createdAtUtc,
    });
    await session.appendOutboxEvent(event);

    return Object.freeze({
      replayed: false,
      posting: next,
      journal: draft.journal,
      provenance: draft.provenance,
      idempotencyRecord: record,
      outboxEvent: event,
    });
  });
}
