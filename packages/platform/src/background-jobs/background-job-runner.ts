import type {
  BackgroundJob,
} from "./background-job.ts";
import type {
  BackgroundJobQueue,
} from "./background-job-queue.ts";
import type {
  BackgroundJobRegistry,
} from "./background-job-registry.ts";

export interface BackgroundJobClock {
  now(): Date;
}

export interface BackgroundJobRetryPolicy {
  nextDelayMilliseconds(
    attemptNumber: number,
  ): number;
}

export interface BackgroundJobRunResult {
  readonly outcome:
    | "idle"
    | "completed"
    | "retry-scheduled"
    | "failed";
  readonly jobId?: string;
}

export class ExponentialBackgroundJobRetryPolicy
  implements BackgroundJobRetryPolicy {
  constructor(
    private readonly initialDelayMilliseconds =
      1_000,
    private readonly maximumDelayMilliseconds =
      60_000,
  ) {
    if (
      !Number.isSafeInteger(
        initialDelayMilliseconds,
      ) ||
      initialDelayMilliseconds < 0
    ) {
      throw new TypeError(
        "Initial retry delay must be a non-negative integer.",
      );
    }

    if (
      !Number.isSafeInteger(
        maximumDelayMilliseconds,
      ) ||
      maximumDelayMilliseconds <
        initialDelayMilliseconds
    ) {
      throw new TypeError(
        "Maximum retry delay must be greater than or equal to the initial delay.",
      );
    }
  }

  nextDelayMilliseconds(
    attemptNumber: number,
  ): number {
    if (
      !Number.isSafeInteger(
        attemptNumber,
      ) ||
      attemptNumber < 1
    ) {
      throw new TypeError(
        "Attempt number must be a positive integer.",
      );
    }

    return Math.min(
      this.initialDelayMilliseconds *
        2 ** (attemptNumber - 1),
      this.maximumDelayMilliseconds,
    );
  }
}

function normalizeError(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message.slice(0, 1_000);
  }

  return "Unknown background job error.";
}

export class BackgroundJobRunner {
  constructor(
    private readonly queue:
      BackgroundJobQueue,
    private readonly registry:
      BackgroundJobRegistry,
    private readonly clock:
      BackgroundJobClock,
    private readonly retryPolicy:
      BackgroundJobRetryPolicy =
        new ExponentialBackgroundJobRetryPolicy(),
  ) {}

  async runNext(): Promise<
    BackgroundJobRunResult
  > {
    const now =
      this.clock.now().toISOString();

    const job =
      await this.queue.reserveNext(now);

    if (job === null) {
      return {
        outcome: "idle",
      };
    }

    return this.#execute(job);
  }

  async #execute(
    job: BackgroundJob,
  ): Promise<BackgroundJobRunResult> {
    try {
      const handler =
        this.registry.require(
          job.jobType,
        );

      await handler.execute(
        job.payload,
        {
          jobId: job.jobId,
          attemptNumber:
            job.attemptCount,
          maximumAttempts:
            job.maximumAttempts,
          ...(job.companyId === undefined
            ? {}
            : {
                companyId:
                  job.companyId,
              }),
          ...(job.branchId === undefined
            ? {}
            : {
                branchId:
                  job.branchId,
              }),
          ...(job.actorId === undefined
            ? {}
            : {
                actorId:
                  job.actorId,
              }),
          ...(job.correlationId ===
          undefined
            ? {}
            : {
                correlationId:
                  job.correlationId,
              }),
        },
      );

      await this.queue.complete(
        job.jobId,
        this.clock.now().toISOString(),
      );

      return {
        outcome: "completed",
        jobId: job.jobId,
      };
    } catch (error: unknown) {
      const message =
        normalizeError(error);

      const failedAt =
        this.clock.now();

      if (
        job.attemptCount <
        job.maximumAttempts
      ) {
        const delay =
          this.retryPolicy
            .nextDelayMilliseconds(
              job.attemptCount,
            );

        await this.queue.retry(
          job.jobId,
          {
            error: message,
            scheduledAt: new Date(
              failedAt.getTime() + delay,
            ).toISOString(),
          },
        );

        return {
          outcome: "retry-scheduled",
          jobId: job.jobId,
        };
      }

      await this.queue.fail(
        job.jobId,
        failedAt.toISOString(),
        message,
      );

      return {
        outcome: "failed",
        jobId: job.jobId,
      };
    }
  }
}
