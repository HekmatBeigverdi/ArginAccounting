import type {
  DatabaseExecutor
} from "@argin/database";

import type {
  SqliteDatabase,
  SqliteExecuteResult
} from "./sqlite-database";

export class DatabaseExecutorAdapter
implements SqliteDatabase {
  constructor(
    private readonly executor:
      DatabaseExecutor
  ) {}

  async execute(
    sql: string,
    parameters?: unknown[]
  ): Promise<SqliteExecuteResult> {
    const result =
      await this.executor.execute(
        sql,
        parameters as any
      );

    const executeResult: SqliteExecuteResult = {
      rowsAffected:
        result.rowsAffected
    };

    if (result.lastInsertId !== undefined) {
      executeResult.lastInsertId =
        result.lastInsertId;
    }

    return executeResult;
  }

  async select<T>(
    sql: string,
    parameters?: unknown[]
  ): Promise<T> {
    return await this.executor.query<T>(
      sql,
      parameters as any
    ) as T;
  }
}
