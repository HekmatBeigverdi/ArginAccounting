import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT_APPLICATION_ERROR_CODES,
  ProductApplicationError,
  ProductSqliteIdempotencyExecutor,
  ProductSqliteImmediateTransactionManager,
  ProductSqliteRepository,
  createProduct,
  createProductIdentifierProfile,
  createProductMasterDataProfile,
  type ProductPersistenceState,
  type ProductSqliteConnection,
  type ProductSqliteConnectionFactory,
} from "../src/index.ts";

class ScriptedConnection implements ProductSqliteConnection {
  readonly executed: string[] = [];
  readonly selected: Array<readonly Record<string, unknown>[]> = [];
  updateRowsAffected = 1;

  async select<T extends Record<string, unknown>>() {
    return (this.selected.shift() ?? []) as readonly T[];
  }

  async execute(sql: string) {
    this.executed.push(sql.trim());
    return {
      rowsAffected: sql.trim().startsWith("UPDATE products")
        ? this.updateRowsAffected
        : 1,
    };
  }
}

const state = (): ProductPersistenceState => Object.freeze({
  product: createProduct({
    productId: "product-1",
    companyId: "company-1",
    code: "PRD-001",
    title: "کالای تست",
    kind: "product",
    createdAt: "2026-08-31T08:00:00.000Z",
  }),
  identifiers: createProductIdentifierProfile(),
  units: null,
  masterData: createProductMasterDataProfile({ kind: "product" }),
  version: 2,
});

test("immediate transaction commits successful operations", async () => {
  const connection = new ScriptedConnection();
  const factory: ProductSqliteConnectionFactory = { async open() { return connection; } };
  const manager = new ProductSqliteImmediateTransactionManager(factory);

  const result = await manager.transaction(async () => "done");

  assert.equal(result, "done");
  assert.deepEqual(connection.executed, ["BEGIN IMMEDIATE", "COMMIT"]);
});

test("immediate transaction rolls back failed operations", async () => {
  const connection = new ScriptedConnection();
  const factory: ProductSqliteConnectionFactory = { async open() { return connection; } };
  const manager = new ProductSqliteImmediateTransactionManager(factory);

  await assert.rejects(
    () => manager.transaction(async () => { throw new Error("boom"); }),
    /boom/,
  );
  assert.deepEqual(connection.executed, ["BEGIN IMMEDIATE", "ROLLBACK"]);
});

test("repository maps stale optimistic update to application concurrency conflict", async () => {
  const connection = new ScriptedConnection();
  connection.updateRowsAffected = 0;
  const repository = new ProductSqliteRepository(connection);

  await assert.rejects(
    () => repository.update(state(), 1),
    (error: unknown) =>
      error instanceof ProductApplicationError &&
      error.code === PRODUCT_APPLICATION_ERROR_CODES.concurrencyConflict,
  );
  assert.equal(connection.executed.length, 1);
});

test("completed idempotency record replays result without executing operation", async () => {
  const connection = new ScriptedConnection();
  connection.selected.push([{
    status: "completed",
    result_json: JSON.stringify({ productId: "product-1", version: 1 }),
  }]);
  const executor = new ProductSqliteIdempotencyExecutor(connection);
  let executions = 0;

  const result = await executor.run("product:create:company-1", "request-1", async () => {
    executions += 1;
    return { productId: "should-not-run", version: 2 };
  });

  assert.deepEqual(result, { productId: "product-1", version: 1 });
  assert.equal(executions, 0);
});
