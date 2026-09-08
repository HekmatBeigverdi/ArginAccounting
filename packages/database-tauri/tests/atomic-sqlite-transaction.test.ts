import assert from "node:assert/strict";
import test from "node:test";

import type { DatabaseExecuteResult, DatabaseValue } from "@argin/database";
import type { AtomicSqliteTransactionBridge } from "../src/atomic-sqlite-transaction-bridge.ts";
import { TauriSqliteExecutor } from "../src/tauri-sqlite-executor.ts";

type ConnectionStub = {
  execute(sql: string, parameters?: readonly unknown[]): Promise<{ rowsAffected: number; lastInsertId?: number }>;
  select<T>(sql: string, parameters?: readonly unknown[]): Promise<T>;
  close(): Promise<void>;
};

type ExecutorConstructor = new (
  connection: ConnectionStub,
  databaseUrl: string,
  bridge: AtomicSqliteTransactionBridge,
) => TauriSqliteExecutor;

class BridgeStub implements AtomicSqliteTransactionBridge {
  readonly calls: string[] = [];
  async begin(databaseUrl: string): Promise<number> { this.calls.push(`begin:${databaseUrl}`); return 41; }
  async execute(transactionId: number, sql: string, _parameters: readonly DatabaseValue[]): Promise<DatabaseExecuteResult> {
    this.calls.push(`execute:${transactionId}:${sql}`); return { rowsAffected: 1 };
  }
  async query<T>(transactionId: number, sql: string): Promise<T[]> {
    this.calls.push(`query:${transactionId}:${sql}`); return [{ value: 7 }] as T[];
  }
  async commit(transactionId: number): Promise<void> { this.calls.push(`commit:${transactionId}`); }
  async rollback(transactionId: number): Promise<void> { this.calls.push(`rollback:${transactionId}`); }
}

const connection: ConnectionStub = {
  async execute() { return { rowsAffected: 1 }; },
  async select<T>() { return [] as T; },
  async close() {},
};

const create = (bridge: AtomicSqliteTransactionBridge): TauriSqliteExecutor => {
  const Executor = TauriSqliteExecutor as unknown as ExecutorConstructor;
  return new Executor(connection, "sqlite:test.db", bridge);
};

test("production transaction bridge commits work on one pinned transaction id", async () => {
  const bridge = new BridgeStub();
  const executor = create(bridge);
  const result = await executor.transaction(async (session) => {
    await session.execute("INSERT A", [true]);
    const row = await session.queryOne<{ value: number }>("SELECT A");
    return row?.value;
  });
  assert.equal(result, 7);
  assert.deepEqual(bridge.calls, [
    "begin:sqlite:test.db",
    "execute:41:INSERT A",
    "query:41:SELECT A",
    "commit:41",
  ]);
});

test("production transaction bridge rolls back application failure and never commits", async () => {
  const bridge = new BridgeStub();
  const executor = create(bridge);
  await assert.rejects(
    () => executor.transaction(async (session) => {
      await session.execute("INSERT A");
      throw new Error("forced failure");
    }),
    /forced failure/u,
  );
  assert.deepEqual(bridge.calls, [
    "begin:sqlite:test.db",
    "execute:41:INSERT A",
    "rollback:41",
  ]);
});
