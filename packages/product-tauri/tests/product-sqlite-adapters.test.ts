import assert from "node:assert/strict";
import test from "node:test";

import type {
  DatabaseExecuteResult,
  DatabaseExecutor,
  DatabaseSession,
  DatabaseValue,
} from "@argin/database";
import {
  ProductApplicationError,
  createProduct,
  createProductIdentifierProfile,
  createProductMasterDataProfile,
  type ProductPersistenceState,
} from "@argin/product";
import {
  SqliteProductIdempotencyExecutor,
  SqliteProductRepository,
  SqliteProductUnitOfWork,
} from "../src/index.ts";

class MemorySession implements DatabaseSession {
  readonly statements: string[] = [];
  readonly queryResults: unknown[] = [];
  updateRowsAffected = 1;
  executeError: Error | null = null;

  async execute(
    sql: string,
    _parameters?: readonly DatabaseValue[],
  ): Promise<DatabaseExecuteResult> {
    this.statements.push(sql.trim());
    if (this.executeError) {
      const error = this.executeError;
      this.executeError = null;
      throw error;
    }
    return {
      rowsAffected: sql.trim().startsWith("UPDATE products")
        ? this.updateRowsAffected
        : 1,
    };
  }

  async query<T>(
    _sql: string,
    _parameters?: readonly DatabaseValue[],
  ): Promise<T[]> {
    const value = this.queryResults.shift();
    return (Array.isArray(value) ? value : []) as T[];
  }

  async queryOne<T>(
    _sql: string,
    _parameters?: readonly DatabaseValue[],
  ): Promise<T | null> {
    const value = this.queryResults.shift();
    return (value ?? null) as T | null;
  }
}

class MemoryExecutor extends MemorySession implements DatabaseExecutor {
  transactionCount = 0;

  async transaction<T>(
    operation: (transaction: DatabaseSession) => Promise<T>,
  ): Promise<T> {
    this.transactionCount += 1;
    return operation(this);
  }

  async close(): Promise<void> {}
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

test("unit of work runs Product repository inside database transaction", async () => {
  const database = new MemoryExecutor();
  const unitOfWork = new SqliteProductUnitOfWork(database);

  const repositoryName = await unitOfWork.run(async ({ products }) =>
    products.constructor.name,
  );

  assert.equal(repositoryName, "SqliteProductRepository");
  assert.equal(database.transactionCount, 1);
});

test("stale optimistic update maps to application concurrency conflict", async () => {
  const database = new MemorySession();
  database.updateRowsAffected = 0;
  const repository = new SqliteProductRepository(database);

  await assert.rejects(
    () => repository.update(state(), 1),
    (error: unknown) =>
      error instanceof ProductApplicationError &&
      error.code === "product.application.concurrency-conflict",
  );
  assert.equal(database.statements.length, 1);
});

test("company-scoped code uniqueness maps to stable code conflict", async () => {
  const database = new MemorySession();
  database.executeError = new Error(
    "UNIQUE constraint failed: products.company_id, products.code",
  );
  const repository = new SqliteProductRepository(database);

  await assert.rejects(
    () => repository.add({ ...state(), version: 1 }),
    (error: unknown) =>
      error instanceof ProductApplicationError &&
      error.code === "product.application.code-conflict",
  );
});

test("completed idempotency request returns stored result without rerunning operation", async () => {
  const database = new MemorySession();
  database.queryResults.push({
    status: "completed",
    result_json: JSON.stringify({ productId: "product-1", version: 1 }),
  });
  const idempotency = new SqliteProductIdempotencyExecutor(database);
  let executions = 0;

  const result = await idempotency.run(
    "product:create:company-1",
    "request-1",
    async () => {
      executions += 1;
      return { productId: "unexpected", version: 2 };
    },
  );

  assert.deepEqual(result, { productId: "product-1", version: 1 });
  assert.equal(executions, 0);
});
