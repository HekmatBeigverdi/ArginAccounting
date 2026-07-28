import { equal } from "node:assert/strict";
import { test } from "node:test";

import type {
  BackgroundJobRunResult
} from "@argin/platform";

import {
  DesktopBackgroundWorker,
  type DesktopWorkerScheduler
} from "../src/platform/desktop-background-worker.ts";

class FakeScheduler
  implements DesktopWorkerScheduler {
  readonly callbacks:
    Array<() => void> = [];

  clearedHandles: unknown[] = [];

  setInterval(
    callback: () => void
  ): unknown {
    const handle = {
      id: this.callbacks.length + 1
    };

    this.callbacks.push(callback);

    return handle;
  }

  clearInterval(handle: unknown): void {
    this.clearedHandles.push(handle);
  }

  tick(): void {
    for (const callback of this.callbacks) {
      callback();
    }
  }
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

test("worker starts only once", async () => {
  const scheduler =
    new FakeScheduler();

  let executionCount = 0;

  const worker =
    new DesktopBackgroundWorker(
      {
        runNext():
          Promise<BackgroundJobRunResult> {
          executionCount += 1;

          return Promise.resolve({
            outcome: "idle"
          });
        }
      },
      {
        scheduler,
        intervalMilliseconds: 1_000
      }
    );

  worker.start();
  worker.start();

  await flushPromises();

  equal(worker.isRunning, true);
  equal(scheduler.callbacks.length, 1);
  equal(executionCount, 1);
});

test("worker stops its scheduler", () => {
  const scheduler =
    new FakeScheduler();

  const worker =
    new DesktopBackgroundWorker(
      {
        runNext: () =>
          Promise.resolve({
            outcome: "idle"
          })
      },
      {
        scheduler
      }
    );

  worker.start();
  worker.stop();
  worker.stop();

  equal(worker.isRunning, false);
  equal(
    scheduler.clearedHandles.length,
    1
  );
});

test("worker prevents overlapping executions", async () => {
  const scheduler =
    new FakeScheduler();

  let executionCount = 0;
  let resolveExecution:
    (() => void) | undefined;

  const pendingExecution =
    new Promise<void>((resolve) => {
      resolveExecution = resolve;
    });

  const worker =
    new DesktopBackgroundWorker(
      {
        async runNext():
          Promise<BackgroundJobRunResult> {
          executionCount += 1;

          await pendingExecution;

          return {
            outcome: "completed",
            jobId: "job-1"
          };
        }
      },
      {
        scheduler
      }
    );

  worker.start();

  await flushPromises();

  scheduler.tick();
  scheduler.tick();

  await flushPromises();

  equal(executionCount, 1);
  equal(worker.isExecuting, true);

  resolveExecution?.();

  await flushPromises();

  equal(worker.isExecuting, false);
});

test("worker continues after runner error", async () => {
  const scheduler =
    new FakeScheduler();

  const receivedErrors: unknown[] = [];

  let executionCount = 0;

  const worker =
    new DesktopBackgroundWorker(
      {
        runNext():
          Promise<BackgroundJobRunResult> {
          executionCount += 1;

          if (executionCount === 1) {
            return Promise.reject(
              new Error("temporary failure")
            );
          }

          return Promise.resolve({
            outcome: "idle"
          });
        }
      },
      {
        scheduler,
        onError: (error: unknown) => {
          receivedErrors.push(error);
        }
      }
    );

  worker.start();

  await flushPromises();

  scheduler.tick();

  await flushPromises();

  equal(worker.isRunning, true);
  equal(executionCount, 2);
  equal(receivedErrors.length, 1);
});

test("stopped worker does not execute scheduled work", async () => {
  const scheduler =
    new FakeScheduler();

  let executionCount = 0;

  const worker =
    new DesktopBackgroundWorker(
      {
        runNext: () => {
          executionCount += 1;

          return Promise.resolve({
            outcome: "idle"
          });
        }
      },
      {
        scheduler
      }
    );

  worker.start();

  await flushPromises();

  worker.stop();
  scheduler.tick();

  await flushPromises();

  equal(executionCount, 1);
});
