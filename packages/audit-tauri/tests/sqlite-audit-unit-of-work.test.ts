import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SqliteAuditUnitOfWork
} from "../src/sqlite-audit-unit-of-work.ts";

function createDatabase(options?: {
  rollbackFails?: boolean;
}) {
  const statements: string[] = [];

  return {
    statements,
    database: {
      async execute(sql: string) {
        statements.push(sql);

        if (
          options?.rollbackFails &&
          sql === "ROLLBACK"
        ) {
          throw new Error("rollback failed");
        }

        return { rowsAffected: 0 };
      },
      async select<T>() {
        return [] as T;
      }
    }
  };
}

describe("SqliteAuditUnitOfWork", () => {
  it("begins and commits a successful transaction", async () => {
    const { database, statements } = createDatabase();
    const unitOfWork = new SqliteAuditUnitOfWork(database);

    const result = await unitOfWork.run(
      async (repositories) => {
        assert.ok(repositories.audit);
        assert.ok(repositories.approval);
        return "completed";
      }
    );

    assert.equal(result, "completed");
    assert.deepEqual(statements, [
      "BEGIN IMMEDIATE",
      "COMMIT"
    ]);
  });

  it("rolls back when the transaction action fails", async () => {
    const { database, statements } = createDatabase();
    const unitOfWork = new SqliteAuditUnitOfWork(database);

    await assert.rejects(
      () => unitOfWork.run(async () => {
        throw new Error("write failed");
      }),
      /write failed/
    );

    assert.deepEqual(statements, [
      "BEGIN IMMEDIATE",
      "ROLLBACK"
    ]);
  });

  it("returns an AggregateError when rollback also fails", async () => {
    const { database, statements } = createDatabase({
      rollbackFails: true
    });
    const unitOfWork = new SqliteAuditUnitOfWork(database);

    await assert.rejects(
      () => unitOfWork.run(async () => {
        throw new Error("write failed");
      }),
      (error: unknown) => {
        assert.ok(error instanceof AggregateError);
        assert.equal(error.errors.length, 2);
        return true;
      }
    );

    assert.deepEqual(statements, [
      "BEGIN IMMEDIATE",
      "ROLLBACK"
    ]);
  });

  it("serializes concurrent transactions", async () => {
    const { database, statements } = createDatabase();
    const unitOfWork = new SqliteAuditUnitOfWork(database);
    const order: string[] = [];

    const first = unitOfWork.run(async () => {
      order.push("first-start");
      await new Promise((resolve) => setTimeout(resolve, 10));
      order.push("first-end");
    });

    const second = unitOfWork.run(async () => {
      order.push("second-start");
      order.push("second-end");
    });

    await Promise.all([first, second]);

    assert.deepEqual(order, [
      "first-start",
      "first-end",
      "second-start",
      "second-end"
    ]);

    assert.deepEqual(statements, [
      "BEGIN IMMEDIATE",
      "COMMIT",
      "BEGIN IMMEDIATE",
      "COMMIT"
    ]);
  });
});
