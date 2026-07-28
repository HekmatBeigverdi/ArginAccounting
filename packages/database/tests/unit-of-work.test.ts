import { equal } from "node:assert/strict";
import { test } from "node:test";

import {
  DatabaseUnitOfWork,
  type DatabaseExecuteResult,
  type DatabaseExecutor,
  type DatabaseSession,
  type DatabaseValue,
} from "../src/index";

class FakeDatabaseExecutor
  implements DatabaseExecutor {
  transactionCount = 0;
  executedStatements: string[] = [];

  execute(
    sql: string,
    _parameters:
      readonly DatabaseValue[] = [],
  ): Promise<DatabaseExecuteResult> {
    this.executedStatements.push(sql);

    return Promise.resolve({
      rowsAffected: 1,
    });
  }

  query<T>(
    _sql: string,
    _parameters:
      readonly DatabaseValue[] = [],
  ): Promise<T[]> {
    return Promise.resolve([]);
  }

  queryOne<T>(
    _sql: string,
    _parameters:
      readonly DatabaseValue[] = [],
  ): Promise<T | null> {
    return Promise.resolve(null);
  }

  async transaction<T>(
    operation: (
      session: DatabaseSession,
    ) => Promise<T>,
  ): Promise<T> {
    this.transactionCount += 1;

    const session: DatabaseSession = {
      execute: (
        sql,
        parameters,
      ) => this.execute(sql, parameters),
      query: <T>(
        sql: string,
        parameters?: readonly DatabaseValue[],
      ) => this.query<T>(sql, parameters),
      queryOne: <T>(
        sql: string,
        parameters?: readonly DatabaseValue[],
      ) => this.queryOne<T>(sql, parameters),
    };

    return operation(session);
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

test("unit of work opens one transaction", async () => {
  const database =
    new FakeDatabaseExecutor();

  const unitOfWork =
    new DatabaseUnitOfWork(database);

  const value = await unitOfWork.run(
    async (session) => {
      await session.execute(
        "UPDATE companies SET version = version + 1",
      );

      await session.execute(
        "INSERT INTO audit_entries (id) VALUES (?)",
        ["audit-1"],
      );

      return "completed";
    },
  );

  equal(value, "completed");
  equal(database.transactionCount, 1);
  equal(
    database.executedStatements.length,
    2,
  );
});

test("transaction session does not expose lifecycle methods", async () => {
  const database =
    new FakeDatabaseExecutor();

  const unitOfWork =
    new DatabaseUnitOfWork(database);

  await unitOfWork.run(async (session) => {
    equal(
      "transaction" in session,
      false,
    );
    equal("close" in session, false);
  });
});
