import type {
  BackgroundJob,
  EnqueueBackgroundJob,
} from "./background-job.ts";

export interface RetryBackgroundJob {
  readonly scheduledAt: string;
  readonly error: string;
}

export interface BackgroundJobQueue {
  enqueue<TPayload>(
    request: EnqueueBackgroundJob<TPayload>,
    now: string,
  ): Promise<BackgroundJob<TPayload>>;

  get(
    jobId: string,
  ): Promise<BackgroundJob | null>;

  reserveNext(
    now: string,
  ): Promise<BackgroundJob | null>;

  complete(
    jobId: string,
    completedAt: string,
  ): Promise<void>;

  retry(
    jobId: string,
    request: RetryBackgroundJob,
  ): Promise<void>;

  fail(
    jobId: string,
    failedAt: string,
    error: string,
  ): Promise<void>;
}
