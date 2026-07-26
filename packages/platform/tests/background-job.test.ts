import assert from "node:assert/strict";
import test from "node:test";

import {
  BackgroundJobRegistry,
  BackgroundJobRunner,
  DuplicateBackgroundJobError,
  DuplicateBackgroundJobHandlerError,
  ExponentialBackgroundJobRetryPolicy,
  InMemoryBackgroundJobQueue,
  InvalidBackgroundJobTransitionError,
  type BackgroundJobClock,
  type BackgroundJobExecutionContext,
  type BackgroundJobHandler,
} from "../src/index.ts";

class FakeClock
  implements BackgroundJobClock {
  constructor(
    private current: Date,
  ) {}

  now(): Date {
    return new Date(
      this.current.getTime(),
    );
  }

  advance(
    milliseconds: number,
  ): void {
    this.current = new Date(
      this.current.getTime() +
        milliseconds,
    );
  }
}

interface TestPayload {
  readonly value: string;
}

class RecordingHandler
  implements
    BackgroundJobHandler<TestPayload> {
  readonly jobType = "test.record";

  readonly received: Array<{
    payload: TestPayload;
    context:
      BackgroundJobExecutionContext;
  }> = [];

  execute(
    payload: TestPayload,
    context:
      BackgroundJobExecutionContext,
  ): Promise<void> {
    this.received.push({
      payload,
      context,
    });

    return Promise.resolve();
  }
}

test("job can be enqueued and retrieved", async () => {
  const queue =
    new InMemoryBackgroundJobQueue();

  await queue.enqueue(
    {
      jobId: "job-1",
      jobType: "test.record",
      payload: {
        value: "hello",
      },
    },
    "2026-07-26T10:00:00.000Z",
  );

  const job =
    await queue.get("job-1");

  assert.equal(job?.status, "pending");
  assert.equal(job?.attemptCount, 0);
  assert.equal(job?.maximumAttempts, 3);
});

test("duplicate job identifiers are rejected", async () => {
  const queue =
    new InMemoryBackgroundJobQueue();

  const request = {
    jobId: "job-1",
    jobType: "test.record",
    payload: {},
  };

  await queue.enqueue(
    request,
    "2026-07-26T10:00:00.000Z",
  );

  await assert.rejects(
    () =>
      queue.enqueue(
        request,
        "2026-07-26T10:00:01.000Z",
      ),
    DuplicateBackgroundJobError,
  );
});

test("future jobs are not reserved early", async () => {
  const queue =
    new InMemoryBackgroundJobQueue();

  await queue.enqueue(
    {
      jobId: "job-1",
      jobType: "test.record",
      payload: {},
      scheduledAt:
        "2026-07-26T11:00:00.000Z",
    },
    "2026-07-26T10:00:00.000Z",
  );

  const job = await queue.reserveNext(
    "2026-07-26T10:59:59.000Z",
  );

  assert.equal(job, null);
});

test("reserving increments attempt count", async () => {
  const queue =
    new InMemoryBackgroundJobQueue();

  await queue.enqueue(
    {
      jobId: "job-1",
      jobType: "test.record",
      payload: {},
    },
    "2026-07-26T10:00:00.000Z",
  );

  const job = await queue.reserveNext(
    "2026-07-26T10:00:00.000Z",
  );

  assert.equal(job?.status, "running");
  assert.equal(job?.attemptCount, 1);
});

test("duplicate handlers are rejected", () => {
  const registry =
    new BackgroundJobRegistry();

  registry.register(
    new RecordingHandler(),
  );

  assert.throws(
    () =>
      registry.register(
        new RecordingHandler(),
      ),
    DuplicateBackgroundJobHandlerError,
  );
});

test("runner completes a successful job", async () => {
  const clock = new FakeClock(
    new Date(
      "2026-07-26T10:00:00.000Z",
    ),
  );

  const queue =
    new InMemoryBackgroundJobQueue();

  const registry =
    new BackgroundJobRegistry();

  const handler =
    new RecordingHandler();

  registry.register(handler);

  await queue.enqueue(
    {
      jobId: "job-1",
      jobType: "test.record",
      payload: {
        value: "hello",
      },
    },
    clock.now().toISOString(),
  );

  const runner =
    new BackgroundJobRunner(
      queue,
      registry,
      clock,
    );

  const result =
    await runner.runNext();

  assert.equal(
    result.outcome,
    "completed",
  );

  assert.equal(
    handler.received.length,
    1,
  );

  assert.equal(
    handler.received[0]?.payload.value,
    "hello",
  );

  const job =
    await queue.get("job-1");

  assert.equal(job?.status, "completed");
});

test("runner returns idle when no job is ready", async () => {
  const clock = new FakeClock(
    new Date(
      "2026-07-26T10:00:00.000Z",
    ),
  );

  const runner =
    new BackgroundJobRunner(
      new InMemoryBackgroundJobQueue(),
      new BackgroundJobRegistry(),
      clock,
    );

  const result =
    await runner.runNext();

  assert.equal(result.outcome, "idle");
});

test("failed execution is scheduled for retry", async () => {
  const clock = new FakeClock(
    new Date(
      "2026-07-26T10:00:00.000Z",
    ),
  );

  const queue =
    new InMemoryBackgroundJobQueue();

  const registry =
    new BackgroundJobRegistry();

  registry.register({
    jobType: "test.fail",
    execute: () =>
      Promise.reject(
        new Error("temporary failure"),
      ),
  });

  await queue.enqueue(
    {
      jobId: "job-1",
      jobType: "test.fail",
      payload: {},
      maximumAttempts: 2,
    },
    clock.now().toISOString(),
  );

  const runner =
    new BackgroundJobRunner(
      queue,
      registry,
      clock,
    );

  const result =
    await runner.runNext();

  assert.equal(
    result.outcome,
    "retry-scheduled",
  );

  const job =
    await queue.get("job-1");

  assert.equal(job?.status, "pending");
  assert.equal(job?.attemptCount, 1);
  assert.equal(
    job?.lastError,
    "temporary failure",
  );
  assert.equal(
    job?.scheduledAt,
    "2026-07-26T10:00:01.000Z",
  );
});

test("job permanently fails after maximum attempts", async () => {
  const clock = new FakeClock(
    new Date(
      "2026-07-26T10:00:00.000Z",
    ),
  );

  const queue =
    new InMemoryBackgroundJobQueue();

  const registry =
    new BackgroundJobRegistry();

  registry.register({
    jobType: "test.fail",
    execute: () =>
      Promise.reject(
        new Error("permanent failure"),
      ),
  });

  await queue.enqueue(
    {
      jobId: "job-1",
      jobType: "test.fail",
      payload: {},
      maximumAttempts: 1,
    },
    clock.now().toISOString(),
  );

  const runner =
    new BackgroundJobRunner(
      queue,
      registry,
      clock,
    );

  const result =
    await runner.runNext();

  assert.equal(
    result.outcome,
    "failed",
  );

  const job =
    await queue.get("job-1");

  assert.equal(job?.status, "failed");
  assert.equal(job?.attemptCount, 1);
  assert.equal(
    job?.lastError,
    "permanent failure",
  );
});

test("completed job cannot be completed twice", async () => {
  const queue =
    new InMemoryBackgroundJobQueue();

  await queue.enqueue(
    {
      jobId: "job-1",
      jobType: "test.record",
      payload: {},
    },
    "2026-07-26T10:00:00.000Z",
  );

  await queue.reserveNext(
    "2026-07-26T10:00:00.000Z",
  );

  await queue.complete(
    "job-1",
    "2026-07-26T10:00:01.000Z",
  );

  await assert.rejects(
    () =>
      queue.complete(
        "job-1",
        "2026-07-26T10:00:02.000Z",
      ),
    InvalidBackgroundJobTransitionError,
  );
});

test("retry policy uses capped exponential delay", () => {
  const policy =
    new ExponentialBackgroundJobRetryPolicy(
      1_000,
      5_000,
    );

  assert.equal(
    policy.nextDelayMilliseconds(1),
    1_000,
  );

  assert.equal(
    policy.nextDelayMilliseconds(2),
    2_000,
  );

  assert.equal(
    policy.nextDelayMilliseconds(3),
    4_000,
  );

  assert.equal(
    policy.nextDelayMilliseconds(4),
    5_000,
  );
});
