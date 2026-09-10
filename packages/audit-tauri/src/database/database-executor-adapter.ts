import type {
  DatabaseExecutor,
  DatabaseSession,
  DatabaseValue
} from "@argin/database";

import type {
  SqliteDatabase,
  SqliteExecuteResult
} from "./sqlite-database.ts";

class DatabaseSessionAdapter
implements SqliteDatabase {
  constructor(
    private readonly executor:
      DatabaseSession
  ) {}

  async execute(
    sql: string,
    parameters?: unknown[]
  ): Promise<SqliteExecuteResult> {
    const result =
      await this.executor.execute(
        sql,
        parameters as DatabaseValue[] | undefined
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
    return await this.executor.query<unknown>(
      sql,
      parameters as DatabaseValue[] | undefined
    ) as T;
  }
}

export class DatabaseExecutorAdapter extends DatabaseSessionAdapter {
  constructor(private readonly database: DatabaseExecutor) {
    super(database);
  }

  transaction<T>(operation: (session: SqliteDatabase) => Promise<T>): Promise<T> {
    return this.database.transaction(session => operation(new DatabaseSessionAdapter(session)));
  }
}
