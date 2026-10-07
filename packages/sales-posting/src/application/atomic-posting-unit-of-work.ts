import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "../domain/sales-posting-domain-errors.ts";
import {
  applySalesPostingCompareAndSwap,
} from "../domain/sales-posting-concurrency.ts";
import type {
  SalesPostingConcurrencyExpectation,
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
import type {
  SalesPostingSourceIdentity,
} from "../domain/sales-posting-source.ts";

export interface SalesPostingOutboxEvent {
  readonly eventId: string;
  readonly eventType: "sales-posting.accounting-recognition.committed";
  readonly aggregateType: "sales-posting";
  readonly aggregateId: string;
  readonly companyId: string;
  readonly sourceDocumentId: string;
  readonly sourceVersion: number;
  readonly postingVersion: number;
  readonly journalVoucherId: string;
  readonly occurredAtUtc: string;
}

export interface SalesPostingAtomicSession {
  findIdempotencyRecord(
    idempotencyKey: string,
  ): Promise<SalesPostingIdempotencyRecord | null>;
  findPosting(
    postingId: string,
  ): Promise<SalesPostingAggregate | null>;
  savePostingCas(
    posting: SalesPostingAggregate,
    expectedVersion: number,
  ): Promise<boolean>;
  saveIdempotencyRecord(
    record: SalesPostingIdempotencyRecord,
  ): Promise<void>;
  appendOutboxEvent(
    event: SalesPostingOutboxEvent,
  ): Promise<void>;
}

export interface SalesPostingAtomicUnitOfWork {
  run<T>(
    work: (session: SalesPostingAtomicSession) => Promise<T>,
  ): Promise<T>;
}

export interface CommitSalesPostingAccountingEffectInput {
  readonly posting: SalesPostingAggregate;
  readonly source: SalesPostingSourceIdentity;
  readonly purpose: SalesPostingPurpose;
  readonly payloadFingerprint: string;
  readonly journalVoucherId: string;
  readonly expectedPostingVersion: number;
  readonly occurredAtUtc: string;
  readonly outboxEventId: string;
}

export interface CommitSalesPostingAccountingEffectResult {
  readonly posting: SalesPostingAggregate;
  readonly idempotencyRecord: SalesPostingIdempotencyRecord;
  readonly outboxEvent: SalesPostingOutboxEvent | null;
  readonly replayed: boolean;
}

function invalid(field: string): never {
  throw new SalesPostingDomainError(
    SALES_POSTING_DOMAIN_ERROR_CODES.atomicCommitInvalid,
    field,
  );
}

function required(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return invalid(field);
  }
  return value.trim();
}

function outboxEvent(
  input: CommitSalesPostingAccountingEffectInput,
  posting: SalesPostingAggregate,
): SalesPostingOutboxEvent {
  return Object.freeze({
    eventId: required(input.outboxEventId, "outboxEventId"),
    eventType: "sales-posting.accounting-recognition.committed",
    aggregateType: "sales-posting",
    aggregateId: posting.postingId,
    companyId: posting.companyId,
    sourceDocumentId: posting.source.sourceDocumentId,
    sourceVersion: posting.source.sourceVersion,
    postingVersion: posting.version,
    journalVoucherId: required(
      input.journalVoucherId,
      "journalVoucherId",
    ),
    occurredAtUtc: input.occurredAtUtc,
  });
}

export async function commitSalesPostingAccountingEffectAtomic(
  input: CommitSalesPostingAccountingEffectInput,
  unitOfWork: SalesPostingAtomicUnitOfWork,
): Promise<CommitSalesPostingAccountingEffectResult> {
  if (!unitOfWork || typeof unitOfWork.run !== "function") {
    return invalid("unitOfWork");
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
      const storedPosting = await session.findPosting(existing.postingId);
      if (
        storedPosting === null
        || storedPosting.postingId !== existing.postingId
        || storedPosting.version < existing.committedPostingVersion
      ) {
        throw new SalesPostingDomainError(
          SALES_POSTING_DOMAIN_ERROR_CODES.replayOutcomeInvalid,
          "storedPosting",
        );
      }

      return Object.freeze({
        posting: storedPosting,
        idempotencyRecord: existing,
        outboxEvent: null,
        replayed: true,
      });
    }

    const current = await session.findPosting(input.posting.postingId);
    if (current === null) {
      throw new SalesPostingDomainError(
        SALES_POSTING_DOMAIN_ERROR_CODES.concurrencyStateMismatch,
        "posting",
      );
    }

    const expectation: SalesPostingConcurrencyExpectation = {
      postingId: input.posting.postingId,
      companyId: input.posting.companyId,
      branchId: input.posting.branchId,
      source: identity.source,
      expectedPostingVersion: input.expectedPostingVersion,
    };

    const next = applySalesPostingCompareAndSwap(
      current,
      expectation,
      input.occurredAtUtc,
    );

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

    const record = createSalesPostingIdempotencyRecord({
      idempotencyKey: key,
      source: identity.source,
      purpose: identity.purpose,
      payloadFingerprint: identity.payloadFingerprint,
      postingId: next.postingId,
      journalVoucherId: required(
        input.journalVoucherId,
        "journalVoucherId",
      ),
      committedPostingVersion: next.version,
      committedAtUtc: input.occurredAtUtc,
    });

    const event = outboxEvent(input, next);

    await session.saveIdempotencyRecord(record);
    await session.appendOutboxEvent(event);

    return Object.freeze({
      posting: next,
      idempotencyRecord: record,
      outboxEvent: event,
      replayed: false,
    });
  });
}
