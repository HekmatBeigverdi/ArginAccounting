import type { DatabaseExecuteResult, DatabaseSession, DatabaseValue } from "@argin/database";

export interface AtomicSqliteTransactionBridge {
  begin(databaseUrl: string): Promise<number>;
  execute(transactionId: number, sql: string, parameters: readonly DatabaseValue[]): Promise<DatabaseExecuteResult>;
  query<T>(transactionId: number, sql: string, parameters: readonly DatabaseValue[]): Promise<T[]>;
  commit(transactionId: number): Promise<void>;
  rollback(transactionId: number): Promise<void>;
}

const normalizeParameters = (parameters: readonly DatabaseValue[]): unknown[] =>
  parameters.map((value) => {
    if (typeof value === "boolean") return value;
    if (value instanceof Uint8Array) return Array.from(value);
    return value;
  });

const loadInvoke = async () => (await import("@tauri-apps/api/core")).invoke;

export class TauriAtomicSqliteTransactionBridge implements AtomicSqliteTransactionBridge {
  async begin(databaseUrl: string): Promise<number> {
    const invoke = await loadInvoke();
    return invoke<number>("atomic_sqlite_begin", { db: databaseUrl });
  }

  async execute(
    transactionId: number,
    sql: string,
    parameters: readonly DatabaseValue[],
  ): Promise<DatabaseExecuteResult> {
    const invoke = await loadInvoke();
    const [rowsAffected, lastInsertId] = await invoke<[number, number]>("atomic_sqlite_execute", {
      transactionId,
      query: sql,
      values: normalizeParameters(parameters),
    });
    return { rowsAffected, lastInsertId };
  }

  async query<T>(
    transactionId: number,
    sql: string,
    parameters: readonly DatabaseValue[],
  ): Promise<T[]> {
    const invoke = await loadInvoke();
    return invoke<T[]>("atomic_sqlite_select", {
      transactionId,
      query: sql,
      values: normalizeParameters(parameters),
    });
  }

  async commit(transactionId: number): Promise<void> {
    const invoke = await loadInvoke();
    await invoke("atomic_sqlite_commit", { transactionId });
  }

  async rollback(transactionId: number): Promise<void> {
    const invoke = await loadInvoke();
    await invoke("atomic_sqlite_rollback", { transactionId });
  }
}

export class AtomicSqliteTransactionSession implements DatabaseSession {
  constructor(
    private readonly bridge: AtomicSqliteTransactionBridge,
    private readonly transactionId: number,
  ) {}

  execute(sql: string, parameters: readonly DatabaseValue[] = []): Promise<DatabaseExecuteResult> {
    return this.bridge.execute(this.transactionId, sql, parameters);
  }

  query<T>(sql: string, parameters: readonly DatabaseValue[] = []): Promise<T[]> {
    return this.bridge.query<T>(this.transactionId, sql, parameters);
  }

  async queryOne<T>(sql: string, parameters: readonly DatabaseValue[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, parameters);
    return rows[0] ?? null;
  }
}
