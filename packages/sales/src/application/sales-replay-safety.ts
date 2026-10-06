import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "../domain/sales-domain-errors.ts";

export interface SalesMutationContext {
  readonly companyId: string;
  readonly branchId: string;
  readonly requestId: string;
  readonly operationId: string;
  readonly operation: string;
  readonly payloadFingerprint: string;
  readonly actorUserId: string;
  readonly occurredAt: string;
}

export type SalesIdempotencyOutcomeKind =
  | "sales-document"
  | "lifecycle"
  | "inventory-issue"
  | "inventory-receipt"
  | "fulfillment";

export interface SalesIdempotencyRecord {
  readonly companyId: string;
  readonly requestId: string;
  readonly operationId: string;
  readonly operation: string;
  readonly payloadFingerprint: string;
  readonly outcomeKind: SalesIdempotencyOutcomeKind;
  readonly outcomeId: string;
  readonly outcomeVersion: number | null;
  readonly outcomeStatus: string | null;
  /** Exact committed response envelope. Replay must not depend on later aggregate state. */
  readonly resultJson: string;
  readonly recordedAt: string;
}

export interface SalesIdempotencyReader {
  findByRequestId(companyId: string, requestId: string): Promise<SalesIdempotencyRecord | null>;
  findByOperationId(companyId: string, operationId: string): Promise<SalesIdempotencyRecord | null>;
}

export interface SalesIdempotencyWriter {
  add(record: SalesIdempotencyRecord): Promise<void>;
}

export type SalesReplayDecision =
  | { readonly kind: "execute"; readonly context: SalesMutationContext }
  | { readonly kind: "replay"; readonly context: SalesMutationContext; readonly record: SalesIdempotencyRecord };

function fail(code: (typeof SALES_DOMAIN_ERROR_CODES)[keyof typeof SALES_DOMAIN_ERROR_CODES], field: string): never {
  throw new SalesDomainError(code, field);
}

function required(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail(SALES_DOMAIN_ERROR_CODES.identityRequired, field);
  return value.trim();
}

function timestamp(value: string, field: string): string {
  if (typeof value !== "string") return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, field);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, field);
  return parsed.toISOString();
}

export function createSalesMutationContext(input: SalesMutationContext): SalesMutationContext {
  if (!input || typeof input !== "object") return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "mutationContext");
  return Object.freeze({
    companyId: required(input.companyId, "mutationContext.companyId"),
    branchId: required(input.branchId, "mutationContext.branchId"),
    requestId: required(input.requestId, "mutationContext.requestId"),
    operationId: required(input.operationId, "mutationContext.operationId"),
    operation: required(input.operation, "mutationContext.operation"),
    payloadFingerprint: required(input.payloadFingerprint, "mutationContext.payloadFingerprint"),
    actorUserId: required(input.actorUserId, "mutationContext.actorUserId"),
    occurredAt: timestamp(input.occurredAt, "mutationContext.occurredAt"),
  });
}

function assertExactIdentity(context: SalesMutationContext, record: SalesIdempotencyRecord): void {
  if (
    record.companyId !== context.companyId ||
    record.requestId !== context.requestId ||
    record.operationId !== context.operationId ||
    record.operation !== context.operation ||
    record.payloadFingerprint !== context.payloadFingerprint
  ) {
    return fail(SALES_DOMAIN_ERROR_CODES.idempotencyConflict, "mutationContext");
  }
}

export async function decideSalesReplay(
  reader: SalesIdempotencyReader,
  input: SalesMutationContext,
): Promise<SalesReplayDecision> {
  const context = createSalesMutationContext(input);
  const [byRequest, byOperation] = await Promise.all([
    reader.findByRequestId(context.companyId, context.requestId),
    reader.findByOperationId(context.companyId, context.operationId),
  ]);

  if (!byRequest && !byOperation) return Object.freeze({ kind: "execute", context });

  if (byRequest && byOperation) {
    if (
      byRequest.requestId !== byOperation.requestId ||
      byRequest.operationId !== byOperation.operationId
    ) {
      return fail(SALES_DOMAIN_ERROR_CODES.idempotencyConflict, "mutationContext.identity");
    }
    assertExactIdentity(context, byRequest);
    assertExactIdentity(context, byOperation);
    return Object.freeze({ kind: "replay", context, record: byRequest });
  }

  const existing = byRequest ?? byOperation!;
  assertExactIdentity(context, existing);
  return Object.freeze({ kind: "replay", context, record: existing });
}

export function createSalesIdempotencyRecord(input: {
  readonly context: SalesMutationContext;
  readonly outcomeKind: SalesIdempotencyOutcomeKind;
  readonly outcomeId: string;
  readonly outcomeVersion?: number | null;
  readonly outcomeStatus?: string | null;
  readonly resultJson: string;
  readonly recordedAt: string;
}): SalesIdempotencyRecord {
  const context = createSalesMutationContext(input.context);
  const version = input.outcomeVersion ?? null;
  if (version !== null && (!Number.isSafeInteger(version) || version < 0)) {
    return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "idempotency.outcomeVersion");
  }
  const resultJson = required(input.resultJson, "idempotency.resultJson");
  try {
    JSON.parse(resultJson);
  } catch {
    return fail(SALES_DOMAIN_ERROR_CODES.idempotencyResultInvalid, "idempotency.resultJson");
  }
  return Object.freeze({
    companyId: context.companyId,
    requestId: context.requestId,
    operationId: context.operationId,
    operation: context.operation,
    payloadFingerprint: context.payloadFingerprint,
    outcomeKind: input.outcomeKind,
    outcomeId: required(input.outcomeId, "idempotency.outcomeId"),
    outcomeVersion: version,
    outcomeStatus: input.outcomeStatus == null ? null : required(input.outcomeStatus, "idempotency.outcomeStatus"),
    resultJson,
    recordedAt: timestamp(input.recordedAt, "idempotency.recordedAt"),
  });
}

export function replaySalesResult<T>(record: SalesIdempotencyRecord): T {
  try {
    return JSON.parse(record.resultJson) as T;
  } catch {
    return fail(SALES_DOMAIN_ERROR_CODES.idempotencyResultInvalid, "idempotency.resultJson");
  }
}
