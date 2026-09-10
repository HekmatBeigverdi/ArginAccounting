import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseExecutor, DatabaseSession } from "@argin/database";
import { SqliteInventoryUnitOfWork } from "../../../packages/inventory-tauri/src/sqlite-inventory-unit-of-work.ts";
import { SqliteFiscalUnitOfWork } from "../../../packages/fiscal-tauri/src/sqlite-fiscal-unit-of-work.ts";

test("inventory numbering uses the existing session and rolls back with the document", async () => {
  let nextNumber = 1;
  let transactionCount = 0;
  let active = false;
  const session: DatabaseSession = {
    async query<T>() { return [] as T[]; },
    async queryOne<T>() {
      return {
        id: "receipt-series", company_id: "company-1", branch_id: null,
        fiscal_year_id: null, entity_type: "inventory.receipt", code: "receipt",
        prefix: "", suffix: "", next_number: nextNumber, padding_length: 6,
        reset_policy: "never", is_active: 1, version: 1,
        created_at: "2026-09-09", updated_at: "2026-09-09",
      } as T;
    },
    async execute(_sql, parameters) {
      assert.ok(active);
      nextNumber = Number(parameters?.[0]);
      return { rowsAffected: 1 };
    },
  };
  const database: DatabaseExecutor = {
    ...session,
    async close() {},
    async transaction<T>(operation: (session: DatabaseSession) => Promise<T>) {
      assert.equal(active, false, "must not open a nested transaction");
      transactionCount += 1;
      const previousNumber = nextNumber;
      active = true;
      try {
        return await operation(session);
      } catch (error) {
        nextNumber = previousNumber;
        throw error;
      } finally {
        active = false;
      }
    },
  };
  const inventory = new SqliteInventoryUnitOfWork(database);
  const reserve = (fail: boolean) => inventory.execute(async (context) => {
    const fiscal = SqliteFiscalUnitOfWork.fromSession(inventory.sessionFor(context));
    const reservation = await fiscal.run(({ numberSeries }) => numberSeries.reserveNext("receipt-series"));
    if (fail) throw new Error("document update failed");
    return reservation.reservedNumber;
  });

  await assert.rejects(() => reserve(true), /document update failed/);
  assert.equal(nextNumber, 1);
  assert.equal(await reserve(false), 1);
  assert.equal(nextNumber, 2);
  assert.equal(transactionCount, 2);
});
