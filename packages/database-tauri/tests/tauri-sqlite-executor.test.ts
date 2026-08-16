import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DatabaseError } from "@argin/database";

import { TauriSqliteExecutor } from "../src/tauri-sqlite-executor.ts";

type ExecuteResult = {
  rowsAffected: number;
  lastInsertId?: number;
};

type ConnectionStub = {
  execute(
    sql: string,
    parameters?: readonly unknown[]
  ): Promise<ExecuteResult>;
  select<T>(sql: string, parameters?: readonly unknown[]): Promise<T>;
  close(): Promise<void>;
};

type ExecutorConstructor = new (
  connection: ConnectionStub
) => TauriSqliteExecutor;

function createExecutor(connection: ConnectionStub): TauriSqliteExecutor {
  const Executor = TauriSqliteExecutor as unknown as ExecutorConstructor;
  return new Executor(connection);
}

function createConnection(options?: {
  failSql?: string;
}) {
  const statements: Array<{
    sql: string;
    parameters: readonly unknown[];
  }> = [];

  const connection: ConnectionStub = {
    async execute(sql, parameters = []) {
      statements.push({ sql, parameters });

      if (sql === options?.failSql) {
        throw new Error(`forced failure: ${sql}`);
      }

      return { rowsAffected: 1 };
    },
    async select<T>() {
      return [] as T;
    },
    async close() {}
  };

  return {
    connection,
    statements,
    executor: createExecutor(connection)
  };
}

describe("TauriSqliteExecutor logical transactions", () => {
  it("runs all work through the serialized session", async () => {
    const { executor, statements } = createConnection();

    const result = await executor.transaction(async (session) => {
      await session.execute("INSERT INTO accounts (active) VALUES (?)", [true]);
      return "completed";
    });

    assert.equal(result, "completed");
    assert.deepEqual(statements, [
      {
        sql: "INSERT INTO accounts (active) VALUES (?)",
        parameters: [1]
      }
    ]);
  });

  it("propagates a statement failure from the session", async () => {
    const { executor, statements } = createConnection({
      failSql: "INSERT BROKEN"
    });
    const originalConsoleError = console.error;
    console.error = () => undefined;

    try {
      await assert.rejects(
        () => executor.transaction(async (session) => {
          await session.execute("INSERT OK");
          await session.execute("INSERT BROKEN");
        }),
        (error: unknown) => {
          assert.ok(error instanceof DatabaseError);
          assert.equal(error.code, "QUERY_FAILED");
          assert.match(error.message, /forced failure: INSERT BROKEN/);
          return true;
        }
      );
    } finally {
      console.error = originalConsoleError;
    }

    assert.deepEqual(
      statements.map(({ sql }) => sql),
      ["INSERT OK", "INSERT BROKEN"]
    );
  });

  it("serializes concurrent transactions on the shared connection", async () => {
    const { executor, statements } = createConnection();
    const operationOrder: string[] = [];
    let releaseFirst!: () => void;
    let markFirstStarted!: () => void;
    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });

    const first = executor.transaction(async () => {
      operationOrder.push("first-start");
      markFirstStarted();
      await firstCanFinish;
      operationOrder.push("first-end");
    });
    const second = executor.transaction(async () => {
      operationOrder.push("second-start");
      operationOrder.push("second-end");
    });

    await firstStarted;
    assert.deepEqual(operationOrder, ["first-start"]);
    releaseFirst();
    await Promise.all([first, second]);

    assert.deepEqual(operationOrder, [
      "first-start",
      "first-end",
      "second-start",
      "second-end"
    ]);
    assert.deepEqual(
      statements.map(({ sql }) => sql),
      []
    );
  });

  it("releases the queue after a failed transaction", async () => {
    const { executor, statements } = createConnection();

    await assert.rejects(
      () => executor.transaction(async () => {
        throw new Error("application failure");
      }),
      /application failure/
    );

    const result = await executor.transaction(async () => "recovered");

    assert.equal(result, "recovered");
    assert.deepEqual(statements, []);
  });
});
