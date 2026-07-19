import Database from "@tauri-apps/plugin-sql";

import {
  DatabaseError,
  type DatabaseExecuteResult,
  type DatabaseExecutor,
  type DatabaseValue
} from "@argin/database";

import { DESKTOP_DATABASE_URL } from "./constants";

function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return null;
}

function normalizeParameters(
  parameters: readonly DatabaseValue[]
): DatabaseValue[] {
  return parameters.map((value) =>
    typeof value === "boolean" ? Number(value) : value
  );
}

export class TauriSqliteExecutor implements DatabaseExecutor {
  private transactionQueue: Promise<void> =
    Promise.resolve();

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
        normalizeParameters(parameters)
      );

      return {
        rowsAffected: result.rowsAffected,
        ...(result.lastInsertId !== undefined
          ? { lastInsertId: result.lastInsertId }
          : {})
      };
    } catch (error) {
      const causeMessage = getErrorMessage(error);
      const errorMessage = causeMessage
        ? `Failed to execute SQLite statement: ${causeMessage}`
        : "Failed to execute the SQLite statement.";

      console.error("SQL Error:", {
        sql: sql.substring(0, 200),
        parameters,
        error
      });

      throw new DatabaseError(
        "QUERY_FAILED",
        errorMessage,
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
        normalizeParameters(parameters)
      );
    } catch (error) {
      const causeMessage = getErrorMessage(error);
      const errorMessage = causeMessage
        ? `Failed to execute SQLite query: ${causeMessage}`
        : "Failed to execute the SQLite query.";

      console.error("SQL Query Error:", {
        sql: sql.substring(0, 200),
        parameters,
        error
      });

      throw new DatabaseError(
        "QUERY_FAILED",
        errorMessage,
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

  async transaction<T>(
    operation: (transaction: DatabaseExecutor) => Promise<T>
  ): Promise<T> {
    const previousOperation = this.transactionQueue;
    let releaseQueue!: () => void;

    this.transactionQueue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });

    await previousOperation;

    try {
      /*
       * tauri-plugin-sql executes every command through a connection
       * pool. BEGIN/COMMIT calls are therefore not guaranteed to use
       * the same SQLite connection and can leave the database locked.
       * Serialize logical units of work until the plugin exposes a
       * connection-bound transaction API.
       */
      return await operation(this);
    } finally {
      releaseQueue();
    }
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
