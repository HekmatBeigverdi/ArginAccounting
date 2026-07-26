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
  readonly scheduledAt?: string;
  readonly maximumAttempts?: number;
}

export interface BackgroundJobExecutionContext {
  readonly jobId: string;
  readonly attemptNumber: number;
  readonly maximumAttempts: number;
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
