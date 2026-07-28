export const BACKGROUND_JOB_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;

export type BackgroundJobStatus =
  (typeof BACKGROUND_JOB_STATUSES)[number];

export interface BackgroundJob<
  TPayload = unknown,
> {
  readonly jobId: string;
  readonly jobType: string;
  readonly payload: TPayload;
  readonly companyId?: string;
  readonly branchId?: string;
  readonly actorId?: string;
  readonly correlationId?: string;
  readonly status: BackgroundJobStatus;
  readonly attemptCount: number;
  readonly maximumAttempts: number;
  readonly scheduledAt: string;
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly lastError?: string;
}

export interface EnqueueBackgroundJob<
  TPayload = unknown,
> {
  readonly jobId: string;
  readonly jobType: string;
  readonly payload: TPayload;
  readonly companyId?: string;
  readonly branchId?: string;
  readonly actorId?: string;
  readonly correlationId?: string;
  readonly scheduledAt?: string;
  readonly maximumAttempts?: number;
}

export interface BackgroundJobExecutionContext {
  readonly jobId: string;
  readonly attemptNumber: number;
  readonly maximumAttempts: number;
  readonly companyId?: string;
  readonly branchId?: string;
  readonly actorId?: string;
  readonly correlationId?: string;
}

export function normalizeBackgroundJobContext(
  request: Pick<
    EnqueueBackgroundJob,
    | "companyId"
    | "branchId"
    | "actorId"
    | "correlationId"
  >,
): {
  readonly companyId?: string;
  readonly branchId?: string;
  readonly actorId?: string;
  readonly correlationId?: string;
} {
  return {
    ...normalizeOptionalContextValue(
      request.companyId,
      "companyId",
    ),
    ...normalizeOptionalContextValue(
      request.branchId,
      "branchId",
    ),
    ...normalizeOptionalContextValue(
      request.actorId,
      "actorId",
    ),
    ...normalizeOptionalContextValue(
      request.correlationId,
      "correlationId",
    ),
  };
}

function normalizeOptionalContextValue(
  value: string | undefined,
  name:
    | "companyId"
    | "branchId"
    | "actorId"
    | "correlationId",
): Partial<
  Record<
    | "companyId"
    | "branchId"
    | "actorId"
    | "correlationId",
    string
  >
> {
  if (value === undefined) {
    return {};
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new TypeError(
      `Background job ${name} cannot be empty.`,
    );
  }

  return {
    [name]: normalized,
  };
}

export function assertBackgroundJobId(
  jobId: string,
): void {
  if (jobId.trim().length === 0) {
    throw new TypeError(
      "Background job identifier cannot be empty.",
    );
  }
}

export function assertBackgroundJobType(
  jobType: string,
): void {
  if (
    !/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/.test(
      jobType,
    )
  ) {
    throw new TypeError(
      "Background job type must use a module-prefixed lowercase identifier.",
    );
  }
}

export function assertMaximumAttempts(
  maximumAttempts: number,
): void {
  if (
    !Number.isSafeInteger(maximumAttempts) ||
    maximumAttempts < 1 ||
    maximumAttempts > 100
  ) {
    throw new TypeError(
      "Maximum attempts must be an integer between 1 and 100.",
    );
  }
}
