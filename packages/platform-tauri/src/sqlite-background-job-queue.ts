import type {
  DatabaseExecutor,
  DatabaseSession
} from "@argin/database";

import {
  BACKGROUND_JOB_STATUSES,
  BackgroundJobNotFoundError,
  DuplicateBackgroundJobError,
  InvalidBackgroundJobTransitionError,
  assertBackgroundJobId,
  assertBackgroundJobType,
  assertMaximumAttempts,
  type BackgroundJob,
  type BackgroundJobQueue,
  type BackgroundJobStatus,
  type EnqueueBackgroundJob,
  type RetryBackgroundJob
} from "@argin/platform";

interface BackgroundJobRow {
  job_id: string;
  job_type: string;
  payload_json: string;
  status: string;
  attempt_count: number;
  maximum_attempts: number;
  scheduled_at: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  last_error: string | null;
}

const SELECT_BACKGROUND_JOB = `
  SELECT
      job_id,
      job_type,
      payload_json,
      status,
      attempt_count,
      maximum_attempts,
      scheduled_at,
      created_at,
      started_at,
      completed_at,
      last_error
  FROM background_jobs
`;

function assertStatus(
  status: string
): BackgroundJobStatus {
  if (
    !BACKGROUND_JOB_STATUSES.includes(
      status as BackgroundJobStatus
    )
  ) {
    throw new TypeError(
      `Unsupported background job status "${status}".`
    );
  }

  return status as BackgroundJobStatus;
}

function mapBackgroundJob<TPayload = unknown>(
  row: BackgroundJobRow
): BackgroundJob<TPayload> {
  return {
    jobId: row.job_id,
    jobType: row.job_type,
    payload: JSON.parse(
      row.payload_json
    ) as TPayload,
    status: assertStatus(row.status),
    attemptCount: row.attempt_count,
    maximumAttempts: row.maximum_attempts,
    scheduledAt: row.scheduled_at,
    createdAt: row.created_at,
    ...(row.started_at !== null
      ? { startedAt: row.started_at }
      : {}),
    ...(row.completed_at !== null
      ? { completedAt: row.completed_at }
      : {}),
    ...(row.last_error !== null
      ? { lastError: row.last_error }
      : {})
  };
}

function serializePayload(
  payload: unknown
): string {
  let payloadJson: string | undefined;

  try {
    payloadJson = JSON.stringify(payload);
  } catch {
    throw new TypeError(
      "Background job payload must be JSON serializable."
    );
  }

  if (payloadJson === undefined) {
    throw new TypeError(
      "Background job payload must be JSON serializable."
    );
  }

  return payloadJson;
}

function truncateError(error: string): string {
  return error.slice(0, 1_000);
}

export class SqliteBackgroundJobQueue
  implements BackgroundJobQueue {
  constructor(
    private readonly database:
      DatabaseExecutor
  ) {}

  async enqueue<TPayload>(
    request: EnqueueBackgroundJob<TPayload>,
    now: string
  ): Promise<BackgroundJob<TPayload>> {
    assertBackgroundJobId(request.jobId);
    assertBackgroundJobType(request.jobType);

    const maximumAttempts =
      request.maximumAttempts ?? 3;

    assertMaximumAttempts(maximumAttempts);

    const payloadJson =
      serializePayload(request.payload);
    const scheduledAt =
      request.scheduledAt ?? now;

    try {
      await this.database.execute(
        `
        INSERT INTO background_jobs
        (
            job_id,
            job_type,
            payload_json,
            status,
            attempt_count,
            maximum_attempts,
            scheduled_at,
            created_at
        )
        VALUES (?, ?, ?, 'pending', 0, ?, ?, ?)
        `,
        [
          request.jobId,
          request.jobType,
          payloadJson,
          maximumAttempts,
          scheduledAt,
          now
        ]
      );
    } catch (error) {
      const existing =
        await this.get(request.jobId);

      if (existing !== null) {
        throw new DuplicateBackgroundJobError(
          request.jobId
        );
      }

      throw error;
    }

    return {
      jobId: request.jobId,
      jobType: request.jobType,
      payload: request.payload,
      status: "pending",
      attemptCount: 0,
      maximumAttempts,
      scheduledAt,
      createdAt: now
    };
  }

  async get(
    jobId: string
  ): Promise<BackgroundJob | null> {
    const row =
      await this.database.queryOne<BackgroundJobRow>(
        `
        ${SELECT_BACKGROUND_JOB}
        WHERE job_id = ?
        LIMIT 1
        `,
        [jobId]
      );

    return row === null
      ? null
      : mapBackgroundJob(row);
  }

  async reserveNext(
    now: string
  ): Promise<BackgroundJob | null> {
    return this.database.transaction(
      async (transaction) => {
        const candidate =
          await transaction.queryOne<BackgroundJobRow>(
            `
            ${SELECT_BACKGROUND_JOB}
            WHERE status = 'pending'
              AND scheduled_at <= ?
            ORDER BY
                scheduled_at ASC,
                created_at ASC
            LIMIT 1
            `,
            [now]
          );

        if (candidate === null) {
          return null;
        }

        const result =
          await transaction.execute(
            `
            UPDATE background_jobs
            SET
                status = 'running',
                attempt_count =
                    attempt_count + 1,
                started_at = ?,
                completed_at = NULL
            WHERE job_id = ?
              AND status = 'pending'
            `,
            [
              now,
              candidate.job_id
            ]
          );

        if (result.rowsAffected !== 1) {
          return null;
        }

        const reserved =
          await this.selectById(
            transaction,
            candidate.job_id
          );

        return reserved === null
          ? null
          : mapBackgroundJob(reserved);
      }
    );
  }

  async complete(
    jobId: string,
    completedAt: string
  ): Promise<void> {
    await this.transition(
      jobId,
      "completed",
      `
      UPDATE background_jobs
      SET
          status = 'completed',
          completed_at = ?,
          last_error = NULL
      WHERE job_id = ?
        AND status = 'running'
      `,
      [completedAt, jobId]
    );
  }

  async retry(
    jobId: string,
    request: RetryBackgroundJob
  ): Promise<void> {
    await this.transition(
      jobId,
      "pending",
      `
      UPDATE background_jobs
      SET
          status = 'pending',
          scheduled_at = ?,
          completed_at = NULL,
          last_error = ?
      WHERE job_id = ?
        AND status = 'running'
        AND attempt_count <
            maximum_attempts
      `,
      [
        request.scheduledAt,
        truncateError(request.error),
        jobId
      ]
    );
  }

  async fail(
    jobId: string,
    failedAt: string,
    error: string
  ): Promise<void> {
    await this.transition(
      jobId,
      "failed",
      `
      UPDATE background_jobs
      SET
          status = 'failed',
          completed_at = ?,
          last_error = ?
      WHERE job_id = ?
        AND status = 'running'
      `,
      [
        failedAt,
        truncateError(error),
        jobId
      ]
    );
  }

  async recoverInterrupted(
    recoveredAt: string
  ): Promise<number> {
    const result =
      await this.database.execute(
        `
        UPDATE background_jobs
        SET
            status = CASE
                WHEN attempt_count >=
                    maximum_attempts
                    THEN 'failed'
                ELSE 'pending'
            END,
            scheduled_at = CASE
                WHEN attempt_count >=
                    maximum_attempts
                    THEN scheduled_at
                ELSE ?
            END,
            completed_at = CASE
                WHEN attempt_count >=
                    maximum_attempts
                    THEN ?
                ELSE NULL
            END,
            last_error = CASE
                WHEN attempt_count >=
                    maximum_attempts
                    THEN
                      'Application stopped during final job attempt.'
                ELSE
                      'Application stopped while the job was running.'
            END
        WHERE status = 'running'
        `,
        [
          recoveredAt,
          recoveredAt
        ]
      );

    return result.rowsAffected;
  }

  private async transition(
    jobId: string,
    requestedStatus:
      BackgroundJobStatus,
    sql: string,
    parameters:
      readonly (
        string | number | boolean | null
      )[]
  ): Promise<void> {
    const result =
      await this.database.execute(
        sql,
        parameters
      );

    if (result.rowsAffected === 1) {
      return;
    }

    const current =
      await this.get(jobId);

    if (current === null) {
      throw new BackgroundJobNotFoundError(
        jobId
      );
    }

    throw new InvalidBackgroundJobTransitionError(
      jobId,
      current.status,
      requestedStatus
    );
  }

  private selectById(
    session: DatabaseSession,
    jobId: string
  ): Promise<BackgroundJobRow | null> {
    return session.queryOne<BackgroundJobRow>(
      `
      ${SELECT_BACKGROUND_JOB}
      WHERE job_id = ?
      LIMIT 1
      `,
      [jobId]
    );
  }
}
