import type { DatabaseSession } from "@argin/database";
import {
  WarehouseApplicationError,
  type WarehouseIdempotencyExecutor,
} from "@argin/warehouse";

interface IdempotencyRow {
  readonly status: "in-progress" | "completed";
  readonly result_json: string | null;
}

const RESULT_FORMAT = "warehouse-idempotency-v1";

function serializeResult<T>(result: T): string {
  // Void operations still need non-NULL JSON to satisfy the completed-row constraint.
  return JSON.stringify({ format: RESULT_FORMAT, result });
}

function deserializeResult<T>(json: string): T {
  const stored = JSON.parse(json);
  if (stored !== null && typeof stored === "object" && stored.format === RESULT_FORMAT) {
    return stored.result as T;
  }
  // Requests completed before the envelope was introduced contain the raw result.
  return stored as T;
}

export class SqliteWarehouseIdempotencyExecutor implements WarehouseIdempotencyExecutor {
  constructor(private readonly database: DatabaseSession) {}

  async run<T>(scope: string, requestId: string, operation: () => Promise<T>): Promise<T> {
    const existing = await this.database.queryOne<IdempotencyRow>(
      `SELECT status, result_json
         FROM warehouse_idempotency
        WHERE scope = ? AND request_id = ?`,
      [scope, requestId],
    );

    if (existing?.status === "completed" && existing.result_json !== null) {
      return deserializeResult<T>(existing.result_json);
    }

    if (existing?.status === "in-progress") {
      throw new WarehouseApplicationError("warehouse.application.concurrency-conflict");
    }

    try {
      await this.database.execute(
        `INSERT INTO warehouse_idempotency
           (scope, request_id, status, result_json, created_at, completed_at)
         VALUES (?, ?, 'in-progress', NULL, datetime('now'), NULL)`,
        [scope, requestId],
      );
    } catch {
      const raced = await this.database.queryOne<IdempotencyRow>(
        `SELECT status, result_json
           FROM warehouse_idempotency
          WHERE scope = ? AND request_id = ?`,
        [scope, requestId],
      );
      if (raced?.status === "completed" && raced.result_json !== null) {
        return deserializeResult<T>(raced.result_json);
      }
      throw new WarehouseApplicationError("warehouse.application.concurrency-conflict");
    }

    try {
      const result = await operation();
      await this.database.execute(
        `UPDATE warehouse_idempotency
            SET status = 'completed', result_json = ?, completed_at = datetime('now')
          WHERE scope = ? AND request_id = ?`,
        [serializeResult(result), scope, requestId],
      );
      return result;
    } catch (error) {
      await this.database.execute(
        "DELETE FROM warehouse_idempotency WHERE scope = ? AND request_id = ?",
        [scope, requestId],
      );
      throw error;
    }
  }
}
