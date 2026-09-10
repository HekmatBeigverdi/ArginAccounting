import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseExecutor, DatabaseSession } from "@argin/database";
import { DatabaseExecutorAdapter } from "../src/database/database-executor-adapter.ts";
import { SqliteAuditUnitOfWork } from "../src/sqlite-audit-unit-of-work.ts";

for (const fail of [false, true]) {
  test(`pooled approval reads and writes stay on the pinned connection (${fail ? "rollback" : "commit"})`, async () => {
    const calls: string[] = [];
    const session: DatabaseSession = {
      async execute() { calls.push("session-write"); return { rowsAffected: 1 }; },
      async query<T>() { calls.push("session-read"); return [] as T[]; },
      async queryOne<T>() { return null as T | null; },
    };
    const executor: DatabaseExecutor = {
      async execute() { throw new Error("write escaped the pinned transaction"); },
      async query() { throw new Error("read escaped the pinned transaction"); },
      async queryOne() { throw new Error("read escaped the pinned transaction"); },
      async close() {},
      async transaction(operation) {
        calls.push("begin");
        try {
          const result = await operation(session);
          calls.push("commit");
          return result;
        } catch (error) {
          calls.push("rollback");
          throw error;
        }
      },
    };
    const uow = new SqliteAuditUnitOfWork(new DatabaseExecutorAdapter(executor));
    const operation = () => uow.run(async repositories => {
      assert.equal(await repositories.approval.findById("approval-1"), null);
      await repositories.approval.addHistory({
        id: "history-1", approvalRequestId: "approval-1", action: "submit",
        fromStatus: "draft", toStatus: "pending",
        actor: { type: "user", id: "user-1", displayName: "User" },
        comment: null, occurredAt: "2026-09-09T10:00:00Z",
      });
      if (fail) throw new Error("approval write failed");
      return "ok";
    });
    if (fail) await assert.rejects(operation, /approval write failed/);
    else assert.equal(await operation(), "ok");
    assert.deepEqual(calls, ["begin", "session-read", "session-write", fail ? "rollback" : "commit"]);
  });
}
