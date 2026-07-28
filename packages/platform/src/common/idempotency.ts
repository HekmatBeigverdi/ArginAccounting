export type IdempotencyStatus =
  | "in-progress"
  | "completed"
  | "failed";

export interface IdempotencyRecord<TResponse = unknown> {
  readonly key: string;
  readonly operation: string;
  readonly status: IdempotencyStatus;
  readonly requestHash?: string;
  readonly response?: TResponse;
  readonly errorCode?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt?: string;
}

export interface BeginIdempotentOperationInput {
  readonly key: string;
  readonly operation: string;
  readonly requestHash?: string;
  readonly createdAt: string;
  readonly expiresAt?: string;
}

export interface IdempotencyStore {
  find<TResponse = unknown>(
    key: string,
    operation: string,
  ): Promise<IdempotencyRecord<TResponse> | null>;

  tryBegin(
    input: BeginIdempotentOperationInput,
  ): Promise<boolean>;

  complete<TResponse>(
    key: string,
    operation: string,
    response: TResponse,
    completedAt: string,
  ): Promise<void>;

  fail(
    key: string,
    operation: string,
    errorCode: string,
    failedAt: string,
  ): Promise<void>;
}

export function createIdempotencyScope(
  operation: string,
  key: string,
): string {
  const normalizedOperation = operation.trim();
  const normalizedKey = key.trim();

  if (normalizedOperation.length === 0) {
    throw new TypeError("Idempotency operation must not be empty.");
  }

  if (normalizedKey.length === 0) {
    throw new TypeError("Idempotency key must not be empty.");
  }

  return `${normalizedOperation}:${normalizedKey}`;
}
