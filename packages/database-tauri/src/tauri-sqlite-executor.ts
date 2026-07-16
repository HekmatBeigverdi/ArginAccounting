import Database from "@tauri-apps/plugin-sql";

import {
  DatabaseError,
  type DatabaseExecuteResult,
  type DatabaseExecutor,
  type DatabaseValue
} from "@argin/database";

import { DESKTOP_DATABASE_URL } from "./constants";

export class TauriSqliteExecutor implements DatabaseExecutor {
  private constructor(
    private readonly connection: Database
  ) {}

  static async connect(
    databaseUrl: string = DESKTOP_DATABASE_URL
  ): Promise<TauriSqliteExecutor> {
    try {
      const connection = await Database.load(databaseUrl);
      const executor = new TauriSqliteExecutor(connection);

      await executor.configureConnection();

      return executor;
    } catch (error) {
      throw new DatabaseError(
        "CONNECTION_FAILED",
        "Failed to connect to the local SQLite database.",
        error
      );
    }
  }

  async execute(
    sql: string,
    parameters: readonly DatabaseValue[] = []
  ): Promise<DatabaseExecuteResult> {
    try {
      const result = await this.connection.execute(
        sql,
        [...parameters]
      );

      return {
        rowsAffected: result.rowsAffected,
        ...(result.lastInsertId !== undefined
          ? { lastInsertId: result.lastInsertId }
          : {})
      };
    } catch (error) {
      throw new DatabaseError(
        "QUERY_FAILED",
        "Failed to execute the SQLite statement.",
        error
      );
    }
  }

  async query<T>(
    sql: string,
    parameters: readonly DatabaseValue[] = []
  ): Promise<T[]> {
    try {
      return await this.connection.select<T[]>(
        sql,
        [...parameters]
      );
    } catch (error) {
      throw new DatabaseError(
        "QUERY_FAILED",
        "Failed to execute the SQLite query.",
        error
      );
    }
  }

  async queryOne<T>(
    sql: string,
    parameters: readonly DatabaseValue[] = []
  ): Promise<T | null> {
    const records = await this.query<T>(sql, parameters);

    return records[0] ?? null;
  }

  async close(): Promise<void> {
    try {
      await this.connection.close();
    } catch (error) {
      throw new DatabaseError(
        "UNKNOWN_DATABASE_ERROR",
        "Failed to close the SQLite database connection.",
        error
      );
    }
  }

  private async configureConnection(): Promise<void> {
    await this.execute("PRAGMA foreign_keys = ON");
    await this.execute("PRAGMA busy_timeout = 5000");
  }
}
