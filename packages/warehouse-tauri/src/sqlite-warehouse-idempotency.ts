import type { DatabaseSession } from "@argin/database";
import {
  WarehouseApplicationError,
  type WarehouseIdempotencyExecutor,
} from "@argin/warehouse";

interface IdempotencyRow {
  readonly status: "in-progress" | "completed";
  readonly result_json: string | null;
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
      return JSON.parse(existing.result_json) as T;
    }

    if (existing?.status === "in-progress") {
      throw new WarehouseApplicationError(
        "warehouse.application.concurrency-conflict",
        "The same Warehouse request is already in progress.",
      );
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
        return JSON.parse(raced.result_json) as T;
      }
      throw new WarehouseApplicationError(
        "warehouse.application.concurrency-conflict",
        "The same Warehouse request is already in progress.",
      );
    }

    try {
      const result = await operation();
      await this.database.execute(
        `UPDATE warehouse_idempotency
            SET status = 'completed', result_json = ?, completed_at = datetime('now')
          WHERE scope = ? AND request_id = ?`,
        [JSON.stringify(result), scope, requestId],
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
