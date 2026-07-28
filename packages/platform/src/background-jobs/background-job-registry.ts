import {
  BackgroundJobHandlerNotFoundError,
  DuplicateBackgroundJobHandlerError,
} from "./background-job-errors.ts";
import type {
  BackgroundJobHandler,
} from "./background-job-handler.ts";
import {
  assertBackgroundJobType,
} from "./background-job.ts";

export class BackgroundJobRegistry {
  readonly #handlers =
    new Map<string, BackgroundJobHandler>();

  register<TPayload>(
    handler:
      BackgroundJobHandler<TPayload>,
  ): void {
    assertBackgroundJobType(
      handler.jobType,
    );

    if (
      this.#handlers.has(handler.jobType)
    ) {
      throw new DuplicateBackgroundJobHandlerError(
        handler.jobType,
      );
    }

    this.#handlers.set(
      handler.jobType,
      handler as BackgroundJobHandler,
    );
  }

  find(
    jobType: string,
  ): BackgroundJobHandler | undefined {
    return this.#handlers.get(jobType);
  }

  require(
    jobType: string,
  ): BackgroundJobHandler {
    const handler = this.find(jobType);

    if (handler === undefined) {
      throw new BackgroundJobHandlerNotFoundError(
        jobType,
      );
    }

    return handler;
  }

  has(
    jobType: string,
  ): boolean {
    return this.#handlers.has(jobType);
  }

  get handlerCount(): number {
    return this.#handlers.size;
  }

  clear(): void {
    this.#handlers.clear();
  }
}
