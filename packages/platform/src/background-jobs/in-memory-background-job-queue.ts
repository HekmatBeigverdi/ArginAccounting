import type {
  BackgroundJob,
  EnqueueBackgroundJob,
} from "./background-job.ts";
import {
  assertBackgroundJobId,
  assertBackgroundJobType,
  assertMaximumAttempts,
} from "./background-job.ts";
import {
  BackgroundJobNotFoundError,
  DuplicateBackgroundJobError,
  InvalidBackgroundJobTransitionError,
} from "./background-job-errors.ts";
import type {
  BackgroundJobQueue,
  RetryBackgroundJob,
} from "./background-job-queue.ts";

function cloneJob(
  job: BackgroundJob,
): BackgroundJob {
  return {
    ...job,
  };
}

export class InMemoryBackgroundJobQueue
  implements BackgroundJobQueue {
  readonly #jobs =
    new Map<string, BackgroundJob>();

  async enqueue<TPayload>(
    request: EnqueueBackgroundJob<TPayload>,
    now: string,
  ): Promise<BackgroundJob<TPayload>> {
    assertBackgroundJobId(request.jobId);
    assertBackgroundJobType(
      request.jobType,
    );

    const maximumAttempts =
      request.maximumAttempts ?? 3;

    assertMaximumAttempts(
      maximumAttempts,
    );

    if (this.#jobs.has(request.jobId)) {
      throw new DuplicateBackgroundJobError(
        request.jobId,
      );
    }

    const job: BackgroundJob<TPayload> = {
      jobId: request.jobId,
      jobType: request.jobType,
      payload: request.payload,
      status: "pending",
      attemptCount: 0,
      maximumAttempts,
      scheduledAt:
        request.scheduledAt ?? now,
      createdAt: now,
    };

    this.#jobs.set(
      job.jobId,
      job,
    );

    return {
      ...job,
    };
  }

  async get(
    jobId: string,
  ): Promise<BackgroundJob | null> {
    const job = this.#jobs.get(jobId);

    return job === undefined
      ? null
      : cloneJob(job);
  }

  async reserveNext(
    now: string,
  ): Promise<BackgroundJob | null> {
    const job = [...this.#jobs.values()]
      .filter(
        (candidate) =>
          candidate.status === "pending" &&
          candidate.scheduledAt <= now,
      )
      .sort((left, right) => {
        const scheduleComparison =
          left.scheduledAt.localeCompare(
            right.scheduledAt,
          );

        if (scheduleComparison !== 0) {
          return scheduleComparison;
        }

        return left.createdAt.localeCompare(
          right.createdAt,
        );
      })[0];

    if (job === undefined) {
      return null;
    }

    const reserved: BackgroundJob = {
      ...job,
      status: "running",
      attemptCount:
        job.attemptCount + 1,
      startedAt: now,
    };

    this.#jobs.set(
      job.jobId,
      reserved,
    );

    return cloneJob(reserved);
  }

  async complete(
    jobId: string,
    completedAt: string,
  ): Promise<void> {
    const job = this.#requireJob(jobId);

    this.#assertStatus(
      job,
      "running",
      "completed",
    );

    const completedJob = {
      ...job,
      status: "completed",
      completedAt,
    } satisfies BackgroundJob;

    delete completedJob.lastError;

    this.#jobs.set(
      jobId,
      completedJob,
    );

  }

  async retry(
    jobId: string,
    request: RetryBackgroundJob,
  ): Promise<void> {
    const job = this.#requireJob(jobId);

    this.#assertStatus(
      job,
      "running",
      "pending",
    );

    if (
      job.attemptCount >=
      job.maximumAttempts
    ) {
      throw new InvalidBackgroundJobTransitionError(
        jobId,
        job.status,
        "pending",
      );
    }

    this.#jobs.set(jobId, {
      ...job,
      status: "pending",
      scheduledAt:
        request.scheduledAt,
      lastError: request.error,
    });

  }

  async fail(
    jobId: string,
    failedAt: string,
    error: string,
  ): Promise<void> {
    const job = this.#requireJob(jobId);

    this.#assertStatus(
      job,
      "running",
      "failed",
    );

    this.#jobs.set(jobId, {
      ...job,
      status: "failed",
      completedAt: failedAt,
      lastError: error,
    });

  }

  get jobCount(): number {
    return this.#jobs.size;
  }

  clear(): void {
    this.#jobs.clear();
  }

  #requireJob(
    jobId: string,
  ): BackgroundJob {
    const job = this.#jobs.get(jobId);

    if (job === undefined) {
      throw new BackgroundJobNotFoundError(
        jobId,
      );
    }

    return job;
  }

  #assertStatus(
    job: BackgroundJob,
    expectedStatus: string,
    requestedStatus: string,
  ): void {
    if (job.status !== expectedStatus) {
      throw new InvalidBackgroundJobTransitionError(
        job.jobId,
        job.status,
        requestedStatus,
      );
    }
  }
}
