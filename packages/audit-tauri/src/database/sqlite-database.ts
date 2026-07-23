export interface SqliteDatabase {
  execute(
    query: string,
    bindValues?: unknown[]
  ): Promise<unknown>;

  select<T>(
    query: string,
    bindValues?: unknown[]
  ): Promise<T>;
}
