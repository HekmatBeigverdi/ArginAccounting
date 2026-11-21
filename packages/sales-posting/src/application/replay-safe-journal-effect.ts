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
import type { SalesPostingSourceIdentity } from "../domain/sales-posting-source.ts";
import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "../domain/sales-posting-domain-errors.ts";

export interface SalesPostingReplayStore {
  findByKey(
    idempotencyKey: string,
  ): Promise<SalesPostingIdempotencyRecord | null>;
  save(record: SalesPostingIdempotencyRecord): Promise<void>;
}

export interface ResolveSalesPostingJournalEffectInput {
  readonly source: SalesPostingSourceIdentity;
  readonly purpose: SalesPostingPurpose;
  readonly payloadFingerprint: string;
  readonly postingId: string;
  readonly journalVoucherId: string;
  readonly committedPostingVersion: number;
  readonly committedAtUtc: string;
}

export interface SalesPostingJournalEffectResolution {
  readonly replayed: boolean;
  readonly idempotencyRecord: SalesPostingIdempotencyRecord;
  readonly postingId: string;
  readonly journalVoucherId: string;
}

export async function resolveSalesPostingJournalEffect(
  input: ResolveSalesPostingJournalEffectInput,
  store: SalesPostingReplayStore,
): Promise<SalesPostingJournalEffectResolution> {
  if (!store || typeof store.findByKey !== "function" || typeof store.save !== "function") {
    throw new SalesPostingDomainError(
      SALES_POSTING_DOMAIN_ERROR_CODES.idempotencyInvalid,
      "store",
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

  const existing = await store.findByKey(key);
  if (existing !== null) {
    assertSalesPostingReplayCompatible(existing, identity);
    return Object.freeze({
      replayed: true,
      idempotencyRecord: existing,
      postingId: existing.postingId,
      journalVoucherId: existing.journalVoucherId,
    });
  }

  const record = createSalesPostingIdempotencyRecord({
    idempotencyKey: key,
    source: identity.source,
    purpose: identity.purpose,
    payloadFingerprint: identity.payloadFingerprint,
    postingId: input.postingId,
    journalVoucherId: input.journalVoucherId,
    committedPostingVersion: input.committedPostingVersion,
    committedAtUtc: input.committedAtUtc,
  });

  await store.save(record);

  return Object.freeze({
    replayed: false,
    idempotencyRecord: record,
    postingId: record.postingId,
    journalVoucherId: record.journalVoucherId,
  });
}
