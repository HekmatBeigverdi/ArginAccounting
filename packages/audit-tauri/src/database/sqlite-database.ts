export interface SqliteExecuteResult {
  rowsAffected?: number;
  lastInsertId?: number;
}

export interface SqliteDatabase {
  /** Use a pinned connection when the database is backed by a connection pool. */
  transaction?<T>(operation: (session: SqliteDatabase) => Promise<T>): Promise<T>;

  execute(
    sql: string,
    parameters?: unknown[]
  ): Promise<SqliteExecuteResult>;

  select<T>(
    sql: string,
    parameters?: unknown[]
  ): Promise<T>;
}
