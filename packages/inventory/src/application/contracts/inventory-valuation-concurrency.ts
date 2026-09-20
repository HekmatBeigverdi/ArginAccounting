import type { InventoryValuationUnitOfWorkContext } from "./inventory-valuation-contracts.ts";

export type InventoryValuationIdempotencyOutcomeKind =
  | "policy"
  | "valuation"
  | "recalculation";

export interface InventoryValuationIdempotencyRecord {
  readonly companyId: string;
  readonly requestId: string;
  readonly operation: string;
  readonly payloadFingerprint: string;
  readonly outcomeKind: InventoryValuationIdempotencyOutcomeKind;
  readonly outcomeId: string;
  readonly outcomeRevision: number | null;
  readonly recordedAt: string;
}

export interface InventoryValuationIdempotencyRepository {
  find(companyId: string, requestId: string): Promise<InventoryValuationIdempotencyRecord | null>;
  add(record: InventoryValuationIdempotencyRecord): Promise<void>;
}

export interface InventoryValuationStreamVersionSnapshot {
  readonly companyId: string;
  readonly streamKey: string;
  readonly revision: number;
}

export interface InventoryValuationStreamVersionRepository {
  get(companyId: string, streamKey: string): Promise<InventoryValuationStreamVersionSnapshot | null>;
  /**
   * Compare-and-swap. Implementations must affect exactly one row or surface a conflict.
   * expectedRevision=0 means the stream must not exist yet and revision 1 is created.
   */
  advance(companyId: string, streamKey: string, expectedRevision: number): Promise<InventoryValuationStreamVersionSnapshot>;
}

export interface InventoryValuationTransactionalContext extends InventoryValuationUnitOfWorkContext {
  readonly idempotency: InventoryValuationIdempotencyRepository;
  readonly streamVersions: InventoryValuationStreamVersionRepository;
}

export interface InventoryValuationTransactionalUnitOfWork {
  execute<T>(work: (context: InventoryValuationTransactionalContext) => Promise<T>): Promise<T>;
}

export type InventoryValuationReplayDecision =
  | { readonly kind: "new" }
  | { readonly kind: "replay"; readonly record: InventoryValuationIdempotencyRecord };

export type InventoryValuationGuardedMutationResult<T> =
  | {
      readonly kind: "committed";
      readonly value: T;
      readonly record: InventoryValuationIdempotencyRecord;
      readonly streamRevision: number;
    }
  | {
      readonly kind: "replay";
      readonly record: InventoryValuationIdempotencyRecord;
    };

export class InventoryValuationConcurrencyError extends Error {
  constructor(
    public readonly code:
      | "VALUATION_IDEMPOTENCY_CONFLICT"
      | "VALUATION_CONCURRENCY_CONFLICT"
      | "VALUATION_CONCURRENCY_INPUT_INVALID",
    public readonly field: string,
  ) {
    super(`${code}:${field}`);
    this.name = "InventoryValuationConcurrencyError";
  }
}

const fail = (code: InventoryValuationConcurrencyError["code"], field: string): never => {
  throw new InventoryValuationConcurrencyError(code, field);
};

const required = (value: string, field: string): string => {
  if (typeof value !== "string" || !value.trim()) return fail("VALUATION_CONCURRENCY_INPUT_INVALID", field);
  return value.trim();
};

const revision = (value: number, field: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) return fail("VALUATION_CONCURRENCY_INPUT_INVALID", field);
  return value;
};

const timestamp = (value: string, field: string): string => {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return fail("VALUATION_CONCURRENCY_INPUT_INVALID", field);
  return parsed.toISOString();
};

export function decideInventoryValuationReplay(input: {
  readonly existing: InventoryValuationIdempotencyRecord | null;
  readonly companyId: string;
  readonly requestId: string;
  readonly operation: string;
  readonly payloadFingerprint: string;
}): InventoryValuationReplayDecision {
  const companyId = required(input.companyId, "companyId");
  const requestId = required(input.requestId, "requestId");
  const operation = required(input.operation, "operation");
  const payloadFingerprint = required(input.payloadFingerprint, "payloadFingerprint");
  const existing = input.existing;
  if (!existing) return Object.freeze({ kind: "new" as const });
  if (
    existing.companyId !== companyId ||
    existing.requestId !== requestId ||
    existing.operation !== operation ||
    existing.payloadFingerprint !== payloadFingerprint
  ) return fail("VALUATION_IDEMPOTENCY_CONFLICT", "requestId");
  return Object.freeze({ kind: "replay" as const, record: existing });
}

export function assertInventoryValuationExpectedRevision(actual: number, expected: number): void {
  if (!Number.isSafeInteger(actual) || actual < 0 || !Number.isSafeInteger(expected) || expected < 0) {
    return fail("VALUATION_CONCURRENCY_INPUT_INVALID", "revision");
  }
  if (actual !== expected) return fail("VALUATION_CONCURRENCY_CONFLICT", "expectedRevision");
}

export function inventoryValuationPolicyStreamKey(companyId: string): string {
  return `policy:${required(companyId, "companyId")}`;
}

export function inventoryValuationProductStreamKey(companyId: string, productId: string): string {
  return `valuation:${required(companyId, "companyId")}:${required(productId, "productId")}`;
}

/**
 * Executes the complete replay/CAS/mutation/outcome sequence inside one transactional UoW.
 * A retry with the same request+fingerprint returns the durable outcome without advancing
 * the stream revision or invoking mutate() again.
 */
export async function executeInventoryValuationGuardedMutation<T>(input: {
  readonly unitOfWork: InventoryValuationTransactionalUnitOfWork;
  readonly companyId: string;
  readonly requestId: string;
  readonly operation: string;
  readonly payloadFingerprint: string;
  readonly streamKey: string;
  readonly expectedRevision: number;
  readonly outcomeKind: InventoryValuationIdempotencyOutcomeKind;
  readonly recordedAt: string;
  readonly mutate: (
    context: InventoryValuationTransactionalContext,
    nextRevision: number,
  ) => Promise<{ readonly value: T; readonly outcomeId: string; readonly outcomeRevision: number | null }>;
}): Promise<InventoryValuationGuardedMutationResult<T>> {
  if (!input || typeof input !== "object" || !input.unitOfWork || typeof input.unitOfWork.execute !== "function") {
    return fail("VALUATION_CONCURRENCY_INPUT_INVALID", "unitOfWork");
  }
  const companyId = required(input.companyId, "companyId");
  const requestId = required(input.requestId, "requestId");
  const operation = required(input.operation, "operation");
  const payloadFingerprint = required(input.payloadFingerprint, "payloadFingerprint");
  const streamKey = required(input.streamKey, "streamKey");
  const expectedRevision = revision(input.expectedRevision, "expectedRevision");
  const recordedAt = timestamp(input.recordedAt, "recordedAt");

  return input.unitOfWork.execute(async (context) => {
    const existing = await context.idempotency.find(companyId, requestId);
    const replay = decideInventoryValuationReplay({ existing, companyId, requestId, operation, payloadFingerprint });
    if (replay.kind === "replay") return Object.freeze({ kind: "replay" as const, record: replay.record });

    const advanced = await context.streamVersions.advance(companyId, streamKey, expectedRevision);
    const mutation = await input.mutate(context, advanced.revision);
    const outcomeId = required(mutation.outcomeId, "outcomeId");
    const outcomeRevision = mutation.outcomeRevision == null ? null : revision(mutation.outcomeRevision, "outcomeRevision");
    const record: InventoryValuationIdempotencyRecord = Object.freeze({
      companyId,
      requestId,
      operation,
      payloadFingerprint,
      outcomeKind: input.outcomeKind,
      outcomeId,
      outcomeRevision,
      recordedAt,
    });
    await context.idempotency.add(record);
    return Object.freeze({ kind: "committed" as const, value: mutation.value, record, streamRevision: advanced.revision });
  });
}
