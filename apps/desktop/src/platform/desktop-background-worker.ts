import type {
  BackgroundJobRunResult
} from "@argin/platform";

export interface DesktopBackgroundJobRunner {
  runNext(): Promise<BackgroundJobRunResult>;
}

export interface DesktopWorkerScheduler {
  setInterval(
    callback: () => void,
    intervalMilliseconds: number
  ): unknown;

  clearInterval(handle: unknown): void;
}

export interface DesktopBackgroundWorkerOptions {
  readonly intervalMilliseconds?: number;
  readonly onError?: (
    error: unknown
  ) => void;
  readonly scheduler?: DesktopWorkerScheduler;
}

const browserScheduler: DesktopWorkerScheduler = {
  setInterval(
    callback: () => void,
    intervalMilliseconds: number
  ): unknown {
    return globalThis.setInterval(
      callback,
      intervalMilliseconds
    );
  },

  clearInterval(handle: unknown): void {
    globalThis.clearInterval(
      handle as ReturnType<
        typeof globalThis.setInterval
      >
    );
  }
};

export class DesktopBackgroundWorker {
  readonly #intervalMilliseconds: number;
  readonly #onError: (
    error: unknown
  ) => void;
  readonly #scheduler:
    DesktopWorkerScheduler;

  #timerHandle: unknown;
  #isRunning = false;
  #isExecuting = false;

  constructor(
    private readonly runner:
      DesktopBackgroundJobRunner,
    options:
      DesktopBackgroundWorkerOptions = {}
  ) {
    const intervalMilliseconds =
      options.intervalMilliseconds ?? 1_000;

    if (
      !Number.isSafeInteger(
        intervalMilliseconds
      ) ||
      intervalMilliseconds < 100
    ) {
      throw new RangeError(
        "Desktop background worker interval must be an integer greater than or equal to 100 milliseconds."
      );
    }

    this.#intervalMilliseconds =
      intervalMilliseconds;

    this.#onError =
      options.onError ??
      ((error: unknown) => {
        console.error(
          "Desktop background worker failed:",
          error
        );
      });

    this.#scheduler =
      options.scheduler ?? browserScheduler;
  }

  start(): void {
    if (this.#isRunning) {
      return;
    }

    this.#isRunning = true;

    void this.runOnce();

    this.#timerHandle =
      this.#scheduler.setInterval(
        () => {
          void this.runOnce();
        },
        this.#intervalMilliseconds
      );
  }

  stop(): void {
    if (!this.#isRunning) {
      return;
    }

    this.#isRunning = false;

    if (this.#timerHandle !== undefined) {
      this.#scheduler.clearInterval(
        this.#timerHandle
      );

      this.#timerHandle = undefined;
    }
  }

  async runOnce(): Promise<
    BackgroundJobRunResult | undefined
  > {
    if (
      !this.#isRunning ||
      this.#isExecuting
    ) {
      return undefined;
    }

    this.#isExecuting = true;

    try {
      return await this.runner.runNext();
    } catch (error: unknown) {
      this.#onError(error);
      return undefined;
    } finally {
      this.#isExecuting = false;
    }
  }

  get isRunning(): boolean {
    return this.#isRunning;
  }

  get isExecuting(): boolean {
    return this.#isExecuting;
  }
}
