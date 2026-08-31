export interface ProductSqliteResult {
  readonly rowsAffected: number;
  readonly lastInsertId?: number;
}

export interface ProductSqliteConnection {
  select<T extends Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<readonly T[]>;
  execute(
    sql: string,
    params?: readonly unknown[],
  ): Promise<ProductSqliteResult>;
}

export interface ProductSqliteTransactionManager {
  transaction<T>(
    operation: (connection: ProductSqliteConnection) => Promise<T>,
  ): Promise<T>;
}
