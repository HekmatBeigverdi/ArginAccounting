import assert from "node:assert/strict";
import test from "node:test";
import type {
  DatabaseExecuteResult,
  DatabaseExecutor,
  DatabaseSession,
  DatabaseValue,
} from "@argin/database";
import { SqliteInventoryValuationStatusReader } from "../src/index.ts";

class StubDatabase implements DatabaseExecutor {
  readonly calls: Array<{
    kind: "query" | "queryOne";
    sql: string;
    parameters: readonly DatabaseValue[];
  }> = [];
  readonly oneResults: unknown[] = [];
  async execute(): Promise<DatabaseExecuteResult> {
    return { rowsAffected: 0 };
  }
  async query<T>(
    sql: string,
    parameters: readonly DatabaseValue[] = [],
  ): Promise<T[]> {
    this.calls.push({ kind: "query", sql, parameters });
    return [];
  }
  async queryOne<T>(
    sql: string,
    parameters: readonly DatabaseValue[] = [],
  ): Promise<T | null> {
    this.calls.push({ kind: "queryOne", sql, parameters });
    return (this.oneResults.shift() ?? null) as T | null;
  }
  async transaction<T>(
    operation: (transaction: DatabaseSession) => Promise<T>,
  ): Promise<T> {
    return operation(this);
  }
  async close(): Promise<void> {}
}

test("currentness ignores original movements already compensated by reversal", async () => {
  const db = new StubDatabase();
  db.oneResults.push(
    { d: "2026-09-13" },
    { d: "2026-09-13" },
    { n: 0 },
    { n: 0 },
    { revision: 2 },
  );

  const status = await new SqliteInventoryValuationStatusReader(db).read({
    companyId: "c1",
    productId: "p1",
  });

  assert.equal(status.status, "current");
  assert.equal(status.unresolvedCount, 0);
  assert.equal(status.streamRevision, 2);
  assert.match(db.calls[0]?.sql ?? "", /reversal_of_movement_id IS NULL/u);
  assert.match(
    db.calls[0]?.sql ?? "",
    /rv\.reversal_of_movement_id=m\.movement_id/u,
  );
  assert.match(
    db.calls[3]?.sql ?? "",
    /e\.valuation_entry_id IS NULL/u,
  );
});
