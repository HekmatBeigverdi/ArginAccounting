import {
  assertSalesPostingReplayCompatible,
  createSalesPostingIdempotencyIdentity,
  createSalesPostingIdempotencyKey,
} from "../domain/sales-posting-idempotency.ts";
import type {
  SalesPostingIdempotencyRecord,
  SalesPostingPurpose,
} from "../domain/sales-posting-idempotency.ts";
import type { SalesPostingAggregate } from "../domain/sales-posting.ts";
import type { SalesPostingSourceIdentity } from "../domain/sales-posting-source.ts";
import {
  assertSalesPostingConcurrency,
} from "../domain/sales-posting-concurrency.ts";
import type {
  SalesPostingConcurrencyExpectation,
} from "../domain/sales-posting-concurrency.ts";

export interface SalesPostingReplayReader {
  findByKey(
    idempotencyKey: string,
  ): Promise<SalesPostingIdempotencyRecord | null>;
}

export interface PrepareSalesPostingMutationInput {
  readonly current: SalesPostingAggregate;
  readonly source: SalesPostingSourceIdentity;
  readonly purpose: SalesPostingPurpose;
  readonly payloadFingerprint: string;
  readonly expectation: SalesPostingConcurrencyExpectation;
}

export type PrepareSalesPostingMutationDecision =
  | {
      readonly kind: "replay";
      readonly record: SalesPostingIdempotencyRecord;
    }
  | {
      readonly kind: "proceed";
      readonly current: SalesPostingAggregate;
    };

export async function prepareSalesPostingMutation(
  input: PrepareSalesPostingMutationInput,
  replay: SalesPostingReplayReader,
): Promise<PrepareSalesPostingMutationDecision> {
  const identity = createSalesPostingIdempotencyIdentity({
    source: input.source,
    purpose: input.purpose,
    payloadFingerprint: input.payloadFingerprint,
  });
  const key = createSalesPostingIdempotencyKey(
    identity.source,
    identity.purpose,
  );

  const existing = await replay.findByKey(key);
  if (existing !== null) {
    assertSalesPostingReplayCompatible(existing, identity);
    return Object.freeze({
      kind: "replay" as const,
      record: existing,
    });
  }

  assertSalesPostingConcurrency(input.current, input.expectation);

  return Object.freeze({
    kind: "proceed" as const,
    current: input.current,
  });
}
