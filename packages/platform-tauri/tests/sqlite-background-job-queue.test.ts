import assert from "node:assert/strict";
import {
  readFileSync
} from "node:fs";
import {
  DatabaseSync
} from "node:sqlite";
import {
  describe,
  it
} from "node:test";

import type {
  DatabaseExecutor,
  DatabaseSession,
  DatabaseValue
} from "@argin/database";

import {
  BackgroundJobNotFoundError,
  DuplicateBackgroundJobError,
  InvalidBackgroundJobTransitionError
} from "@argin/platform";

import {
  SqliteBackgroundJobQueue
} from "../src/index.ts";

const migrationSql = readFileSync(
  new URL(
    "../../../apps/desktop/src-tauri/migrations/0007_background_jobs.sql",
    import.meta.url
  ),
  "utf8"
);

class TestSqliteExecutor
  implements DatabaseExecutor {
  constructor(
    private readonly database:
      DatabaseSync = new DatabaseSync(":memory:")
  ) {
    this.database.exec(migrationSql);
  }

  async execute(
    sql: string,
    parameters:
      readonly DatabaseValue[] = []
  ) {
    const result =
      this.database
        .prepare(sql)
        .run(...parameters);

    return {
      rowsAffected: Number(result.changes),
      ...(result.lastInsertRowid !== undefined
        ? {
            lastInsertId:
              Number(result.lastInsertRowid)
          }
        : {})
    };
  }

  async query<T>(
    sql: string,
    parameters:
      readonly DatabaseValue[] = []
  ): Promise<T[]> {
    return this.database
      .prepare(sql)
      .all(...parameters) as T[];
  }

  async queryOne<T>(
    sql: string,
    parameters:
      readonly DatabaseValue[] = []
  ): Promise<T | null> {
    return (
      this.database
        .prepare(sql)
        .get(...parameters) as T | undefined
    ) ?? null;
  }

  async transaction<T>(
    operation: (
      transaction: DatabaseSession
    ) => Promise<T>
  ): Promise<T> {
    this.database.exec("BEGIN IMMEDIATE");

    try {
      const result =
        await operation(this);

      this.database.exec("COMMIT");

      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  async close(): Promise<void> {
    this.database.close();
  }
}

const firstTime =
  "2026-07-28T08:00:00.000Z";
const secondTime =
  "2026-07-28T09:00:00.000Z";

function createQueue() {
  const database =
    new TestSqliteExecutor();

  return {
    database,
    queue:
      new SqliteBackgroundJobQueue(
        database
      )
  };
}

async function enqueueReadyJob(
  queue: SqliteBackgroundJobQueue,
  options: {
    jobId?: string;
    maximumAttempts?: number;
    scheduledAt?: string;
  } = {}
) {
  return queue.enqueue(
    {
      jobId: options.jobId ?? "job-1",
      jobType: "test.process",
      payload: {
        invoiceId: "invoice-1"
      },
      ...(options.maximumAttempts !== undefined
        ? {
            maximumAttempts:
              options.maximumAttempts
          }
        : {}),
      ...(options.scheduledAt !== undefined
        ? {
            scheduledAt:
              options.scheduledAt
          }
        : {})
    },
    firstTime
  );
}

describe(
  "SqliteBackgroundJobQueue",
  () => {
    it(
      "stores and restores a job with its payload",
      async () => {
        const { queue } = createQueue();

        await enqueueReadyJob(queue);

        const restored =
          await queue.get("job-1");

        assert.deepEqual(
          restored?.payload,
          {
            invoiceId: "invoice-1"
          }
        );
        assert.equal(
          restored?.status,
          "pending"
        );
      }
    );

    it(
      "persists a job across queue instances",
      async () => {
        const { database, queue } =
          createQueue();

        await enqueueReadyJob(queue);

        const replacement =
          new SqliteBackgroundJobQueue(
            database
          );

        assert.equal(
          (await replacement.get("job-1"))
            ?.jobId,
          "job-1"
        );
      }
    );

    it(
      "rejects duplicate identifiers",
      async () => {
        const { queue } = createQueue();

        await enqueueReadyJob(queue);

        await assert.rejects(
          () => enqueueReadyJob(queue),
          DuplicateBackgroundJobError
        );
      }
    );

    it(
      "does not reserve a future job",
      async () => {
        const { queue } = createQueue();

        await enqueueReadyJob(queue, {
          scheduledAt: secondTime
        });

        assert.equal(
          await queue.reserveNext(
            firstTime
          ),
          null
        );
      }
    );

    it(
      "reserves the oldest ready job",
      async () => {
        const { queue } = createQueue();

        await enqueueReadyJob(queue, {
          jobId: "job-later",
          scheduledAt: secondTime
        });
        await enqueueReadyJob(queue, {
          jobId: "job-earlier",
          scheduledAt: firstTime
        });

        assert.equal(
          (
            await queue.reserveNext(
              secondTime
            )
          )?.jobId,
          "job-earlier"
        );
      }
    );

    it(
      "increments the attempt count when reserving",
      async () => {
        const { queue } = createQueue();

        await enqueueReadyJob(queue);

        const reserved =
          await queue.reserveNext(
            firstTime
          );

        assert.equal(
          reserved?.attemptCount,
          1
        );
        assert.equal(
          reserved?.status,
          "running"
        );
      }
    );

    it(
      "transitions running to completed",
      async () => {
        const { queue } = createQueue();

        await enqueueReadyJob(queue);
        await queue.reserveNext(firstTime);
        await queue.complete(
          "job-1",
          secondTime
        );

        const completed =
          await queue.get("job-1");

        assert.equal(
          completed?.status,
          "completed"
        );
        assert.equal(
          completed?.completedAt,
          secondTime
        );
      }
    );

    it(
      "transitions running to pending for retry",
      async () => {
        const { queue } = createQueue();

        await enqueueReadyJob(queue);
        await queue.reserveNext(firstTime);
        await queue.retry("job-1", {
          scheduledAt: secondTime,
          error: "temporary"
        });

        const retried =
          await queue.get("job-1");

        assert.equal(
          retried?.status,
          "pending"
        );
        assert.equal(
          retried?.scheduledAt,
          secondTime
        );
        assert.equal(
          retried?.lastError,
          "temporary"
        );
      }
    );

    it(
      "transitions running to failed",
      async () => {
        const { queue } = createQueue();

        await enqueueReadyJob(queue);
        await queue.reserveNext(firstTime);
        await queue.fail(
          "job-1",
          secondTime,
          "permanent"
        );

        assert.equal(
          (await queue.get("job-1"))
            ?.status,
          "failed"
        );
      }
    );

    it(
      "rejects invalid and missing transitions",
      async () => {
        const { queue } = createQueue();

        await enqueueReadyJob(queue);

        await assert.rejects(
          () => queue.complete(
            "job-1",
            secondTime
          ),
          InvalidBackgroundJobTransitionError
        );

        await assert.rejects(
          () => queue.complete(
            "missing",
            secondTime
          ),
          BackgroundJobNotFoundError
        );
      }
    );

    it(
      "recovers an interrupted job for retry",
      async () => {
        const { queue } = createQueue();

        await enqueueReadyJob(queue);
        await queue.reserveNext(firstTime);

        assert.equal(
          await queue.recoverInterrupted(
            secondTime
          ),
          1
        );

        const recovered =
          await queue.get("job-1");

        assert.equal(
          recovered?.status,
          "pending"
        );
        assert.equal(
          recovered?.attemptCount,
          1
        );
        assert.equal(
          recovered?.scheduledAt,
          secondTime
        );
      }
    );

    it(
      "fails an interrupted final attempt",
      async () => {
        const { queue } = createQueue();

        await enqueueReadyJob(queue, {
          maximumAttempts: 1
        });
        await queue.reserveNext(firstTime);
        await queue.recoverInterrupted(
          secondTime
        );

        const recovered =
          await queue.get("job-1");

        assert.equal(
          recovered?.status,
          "failed"
        );
        assert.equal(
          recovered?.completedAt,
          secondTime
        );
      }
    );

    it(
      "rejects a non-serializable payload",
      async () => {
        const { queue } = createQueue();

        await assert.rejects(
          () => queue.enqueue(
            {
              jobId: "job-undefined",
              jobType: "test.process",
              payload: undefined
            },
            firstTime
          ),
          /must be JSON serializable/
        );

        const circular:
          Record<string, unknown> = {};
        circular.self = circular;

        await assert.rejects(
          () => queue.enqueue(
            {
              jobId: "job-circular",
              jobType: "test.process",
              payload: circular
            },
            firstTime
          ),
          /must be JSON serializable/
        );
      }
    );

    it(
      "limits persisted errors to 1000 characters",
      async () => {
        const { queue } = createQueue();

        await enqueueReadyJob(queue);
        await queue.reserveNext(firstTime);
        await queue.fail(
          "job-1",
          secondTime,
          "x".repeat(1_500)
        );

        assert.equal(
          (await queue.get("job-1"))
            ?.lastError?.length,
          1_000
        );
      }
    );

    it(
      "returns null when no job is ready",
      async () => {
        const { queue } = createQueue();

        assert.equal(
          await queue.reserveNext(
            firstTime
          ),
          null
        );
      }
    );
  }
);

describe(
  "background job migration",
  () => {
    it(
      "creates the table and ready index",
      () => {
        const database =
          new DatabaseSync(":memory:");

        database.exec(migrationSql);

        const names =
          database
            .prepare(
              `
              SELECT name
              FROM sqlite_master
              WHERE name IN (
                'background_jobs',
                'idx_background_jobs_ready'
              )
              ORDER BY name
              `
            )
            .all()
            .map((row) => row.name);

        assert.deepEqual(names, [
          "background_jobs",
          "idx_background_jobs_ready"
        ]);
      }
    );

    it(
      "rejects invalid constrained values",
      () => {
        const database =
          new DatabaseSync(":memory:");

        database.exec(migrationSql);

        const insert =
          database.prepare(
            `
            INSERT INTO background_jobs
            (
              job_id,
              job_type,
              payload_json,
              status,
              maximum_attempts,
              scheduled_at,
              created_at
            )
            VALUES (?, 'test.process', ?, ?, ?, ?, ?)
            `
          );

        assert.throws(
          () => insert.run(
            "bad-status",
            "{}",
            "unknown",
            3,
            firstTime,
            firstTime
          ),
          /CHECK constraint failed/
        );

        assert.throws(
          () => insert.run(
            "bad-attempts",
            "{}",
            "pending",
            0,
            firstTime,
            firstTime
          ),
          /CHECK constraint failed/
        );

        assert.throws(
          () => insert.run(
            "bad-json",
            "not-json",
            "pending",
            3,
            firstTime,
            firstTime
          ),
          /CHECK constraint failed/
        );
      }
    );
  }
);
