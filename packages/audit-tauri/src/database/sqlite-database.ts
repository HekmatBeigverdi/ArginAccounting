export interface SqliteExecuteResult {
  rowsAffected?: number;
  lastInsertId?: number;
}

export interface SqliteDatabase {
  execute(
    sql: string,
    parameters?: unknown[]
  ): Promise<SqliteExecuteResult>;

  select<T>(
    sql: string,
    parameters?: unknown[]
  ): Promise<T>;
}
