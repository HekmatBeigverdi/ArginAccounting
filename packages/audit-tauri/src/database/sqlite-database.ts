export interface SqliteDatabase {

  execute(
    sql: string,
    parameters?: unknown[]
  ): Promise<unknown>;

  select<T>(
    sql: string,
    parameters?: unknown[]
  ): Promise<T>;

  beginTransaction(): Promise<void>;

  commit(): Promise<void>;

  rollback(): Promise<void>;

}
