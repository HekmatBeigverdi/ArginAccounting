import type {
  JournalVoucherReversalResult,
  ReverseJournalVoucherCommand,
} from "@argin/accounting/journal";

import {
  reversePurchasePosting,
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

export interface PurchasePostingReversalRecord {
  readonly postingId: string;
  readonly originalJournalVoucherId: string;
  readonly reversalJournalVoucherId: string;
  readonly requestId: string;
  readonly reversedBy: string;
  readonly reversedAt: string;
  readonly reason: string;
  readonly committedPostingVersion: number;
}

export interface PurchasePostingReversalSession {
  findPosting(postingId: string): Promise<PurchasePostingAggregate | null>;
  findReversalByRequestId(
    companyId: string,
    requestId: string,
  ): Promise<PurchasePostingReversalRecord | null>;
  reverseJournal(
    command: ReverseJournalVoucherCommand,
  ): Promise<JournalVoucherReversalResult>;
  saveReversedPosting(
    posting: PurchasePostingAggregate,
    expectedVersion: number,
    reversal: PurchasePostingReversalRecord,
  ): Promise<void>;
}

export interface PurchasePostingReversalUnitOfWork {
  run<T>(work: (session: PurchasePostingReversalSession) => Promise<T>): Promise<T>;
}

export interface ReversePurchasePostingCommand {
  readonly postingId: string;
  readonly companyId: string;
  readonly expectedPostingVersion: number;
  readonly expectedJournalVersion: number;
  readonly actorId: string;
  readonly occurredAt: string;
  readonly reversalDate: string;
  readonly requestId: string;
  readonly correlationId?: string | null;
  readonly causationId?: string | null;
  readonly reason: string;
  readonly replacementVoucherId?: string | null;
}

export interface ReversePurchasePostingResult {
  readonly posting: PurchasePostingAggregate;
  readonly journalReversal: JournalVoucherReversalResult;
  readonly reversal: PurchasePostingReversalRecord;
  readonly replayed: boolean;
}

const fail = (code: PurchasePostingDomainErrorCode, field: string): never => {
  throw new PurchasePostingDomainError(code, field);
};

function requireText(value: string, field: string, maxLength = 500): string {
  if (typeof value !== "string") {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.reversalInvalid, field);
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0 || normalized.length > maxLength) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.reversalInvalid, field);
  }
  return normalized;
}

function assertJournalOutcome(
  posting: PurchasePostingAggregate,
  result: JournalVoucherReversalResult,
): void {
  if (
    posting.journalVoucherId === null
    || result.originalVoucher.id !== posting.journalVoucherId
    || result.originalVoucher.status !== "reversed"
    || result.reversalVoucher.status !== "posted"
    || result.lineage.originalVoucherId !== posting.journalVoucherId
    || result.lineage.reversalVoucherId !== result.reversalVoucher.id
  ) {
    return fail(
      PURCHASE_POSTING_DOMAIN_ERROR_CODES.reversalOutcomeInvalid,
      "journalReversal",
    );
  }
}

export async function reversePurchasePostingControlled(
  command: ReversePurchasePostingCommand,
  unitOfWork: PurchasePostingReversalUnitOfWork,
): Promise<ReversePurchasePostingResult> {
  if (!unitOfWork || typeof unitOfWork.run !== "function") {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.reversalInvalid, "unitOfWork");
  }

  const postingId = requireText(command.postingId, "postingId", 128);
  const companyId = requireText(command.companyId, "companyId", 128);
  const actorId = requireText(command.actorId, "actorId", 128);
  const requestId = requireText(command.requestId, "requestId", 128);
  const reason = requireText(command.reason, "reason", 500);

  return unitOfWork.run(async (session) => {
    const replay = await session.findReversalByRequestId(companyId, requestId);
    if (replay !== null) {
      if (replay.postingId !== postingId) {
        return fail(
          PURCHASE_POSTING_DOMAIN_ERROR_CODES.reversalConflict,
          "requestId",
        );
      }

      const posting = await session.findPosting(replay.postingId);
      if (
        posting === null
        || posting.status !== "reversed"
        || posting.version !== replay.committedPostingVersion
        || posting.journalVoucherId !== replay.originalJournalVoucherId
      ) {
        return fail(
          PURCHASE_POSTING_DOMAIN_ERROR_CODES.reversalOutcomeInvalid,
          "storedOutcome",
        );
      }

      const replayedJournal = await session.reverseJournal({
        originalVoucherId: replay.originalJournalVoucherId,
        companyId,
        expectedVersion: command.expectedJournalVersion,
        actorId,
        occurredAt: command.occurredAt,
        reversalDate: command.reversalDate,
        requestId,
        correlationId: command.correlationId,
        causationId: command.causationId,
        reason,
        replacementVoucherId: command.replacementVoucherId,
      });
      assertJournalOutcome(posting, replayedJournal);

      return Object.freeze({
        posting,
        journalReversal: replayedJournal,
        reversal: replay,
        replayed: true,
      });
    }

    const current = await session.findPosting(postingId);
    if (current === null || current.companyId !== companyId) {
      return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.reversalInvalid, "posting");
    }
    if (current.status !== "posted" || current.journalVoucherId === null) {
      return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.reversalInvalid, "posting.status");
    }
    if (current.version !== command.expectedPostingVersion) {
      return fail(
        PURCHASE_POSTING_DOMAIN_ERROR_CODES.concurrencyConflict,
        "expectedPostingVersion",
      );
    }

    const journalReversal = await session.reverseJournal({
      originalVoucherId: current.journalVoucherId,
      companyId,
      expectedVersion: command.expectedJournalVersion,
      actorId,
      occurredAt: command.occurredAt,
      reversalDate: command.reversalDate,
      requestId,
      correlationId: command.correlationId,
      causationId: command.causationId,
      reason,
      replacementVoucherId: command.replacementVoucherId,
    });
    assertJournalOutcome(current, journalReversal);

    const reversed = reversePurchasePosting(current, {
      originalJournalVoucherId: current.journalVoucherId,
      expectedVersion: command.expectedPostingVersion,
      occurredAt: journalReversal.lineage.reversedAt,
    });

    const reversal = Object.freeze({
      postingId: reversed.postingId,
      originalJournalVoucherId: current.journalVoucherId,
      reversalJournalVoucherId: journalReversal.reversalVoucher.id,
      requestId,
      reversedBy: journalReversal.lineage.reversedBy,
      reversedAt: journalReversal.lineage.reversedAt,
      reason: journalReversal.lineage.reason,
      committedPostingVersion: reversed.version,
    });

    await session.saveReversedPosting(
      reversed,
      command.expectedPostingVersion,
      reversal,
    );

    return Object.freeze({
      posting: reversed,
      journalReversal,
      reversal,
      replayed: false,
    });
  });
}
