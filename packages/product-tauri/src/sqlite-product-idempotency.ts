import type { DatabaseSession } from "@argin/database";
import {
  ProductApplicationError,
  type ProductIdempotencyExecutor,
} from "@argin/product";

interface IdempotencyRow {
  status: "in-progress" | "completed";
  result_json: string | null;
}

export class SqliteProductIdempotencyExecutor implements ProductIdempotencyExecutor {
  constructor(private readonly database: DatabaseSession) {}

  async run<T>(
    scope: string,
    requestId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const existing = await this.database.queryOne<IdempotencyRow>(
      `SELECT status, result_json
         FROM product_idempotency
        WHERE scope = ? AND request_id = ?`,
      [scope, requestId],
    );

    if (existing?.status === "completed" && existing.result_json !== null) {
      return JSON.parse(existing.result_json) as T;
    }
    if (existing?.status === "in-progress") {
      throw new ProductApplicationError(
        "product.application.concurrency-conflict",
        "The same Product request is already in progress.",
      );
    }

    try {
      await this.database.execute(
        `INSERT INTO product_idempotency
           (scope, request_id, status, result_json, created_at, completed_at)
         VALUES (?, ?, 'in-progress', NULL, datetime('now'), NULL)`,
        [scope, requestId],
      );
    } catch {
      const raced = await this.database.queryOne<IdempotencyRow>(
        `SELECT status, result_json
           FROM product_idempotency
          WHERE scope = ? AND request_id = ?`,
        [scope, requestId],
      );
      if (raced?.status === "completed" && raced.result_json !== null) {
        return JSON.parse(raced.result_json) as T;
      }
      throw new ProductApplicationError(
        "product.application.concurrency-conflict",
        "The same Product request is already in progress.",
      );
    }

    try {
      const result = await operation();
      await this.database.execute(
        `UPDATE product_idempotency
            SET status = 'completed',
                result_json = ?,
                completed_at = datetime('now')
          WHERE scope = ? AND request_id = ?`,
        [JSON.stringify(result), scope, requestId],
      );
      return result;
    } catch (error) {
      await this.database.execute(
        "DELETE FROM product_idempotency WHERE scope = ? AND request_id = ?",
        [scope, requestId],
      );
      throw error;
    }
  }
}
