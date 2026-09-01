import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT_APPLICATION_ERROR_CODES,
  PRODUCT_QUERY_LIMITS,
  ProductApplicationError,
  createProduct,
  createProductIdentifierProfile,
  createProductMasterDataProfile,
  type ListProductsQuery,
  type ProductPersistenceState,
  type ProductReader,
  type ProductRepository,
  type ProductSelectorQuery,
  type ProductUnitOfWork,
} from "../src/index.ts";

const state: ProductPersistenceState = {
  product: createProduct({
    productId: "product-1",
    companyId: "company-1",
    code: "P-001",
    title: "Test product",
    kind: "product",
    createdAt: "2026-08-31T00:00:00Z",
  }),
  identifiers: createProductIdentifierProfile({}),
  units: null,
  masterData: createProductMasterDataProfile({ kind: "product" }),
  version: 1,
};

test("defines explicit bounded list and selector query limits", () => {
  assert.deepEqual(PRODUCT_QUERY_LIMITS, {
    minPageSize: 1,
    maxPageSize: 200,
    defaultPageSize: 50,
    minSelectorLimit: 1,
    maxSelectorLimit: 100,
    defaultSelectorLimit: 20,
  });
  assert.equal(Object.isFrozen(PRODUCT_QUERY_LIMITS), true);

  const listQuery: ListProductsQuery = {
    filter: {
      companyId: "company-1",
      kinds: ["product"],
      statuses: ["active"],
      purchasable: true,
    },
    page: { page: 1, pageSize: PRODUCT_QUERY_LIMITS.defaultPageSize },
    sort: { field: "code", direction: "asc" },
  };
  const selectorQuery: ProductSelectorQuery = {
    companyId: "company-1",
    search: "test",
    sellable: true,
    limit: PRODUCT_QUERY_LIMITS.defaultSelectorLimit,
  };

  assert.equal(listQuery.filter.companyId, "company-1");
  assert.equal(listQuery.page.pageSize, 50);
  assert.equal(selectorQuery.limit, 20);
});

test("repository contract is identity-scoped and concurrency-aware without findAll", async () => {
  const repository: ProductRepository = {
    async findById(companyId, productId) {
      return companyId === "company-1" && productId === "product-1" ? state : null;
    },
    async findByCode(companyId, code) {
      return companyId === "company-1" && code === "P-001" ? state : null;
    },
    async add() {},
    async update(_state, expectedVersion) {
      assert.equal(expectedVersion, 1);
    },
  };

  assert.equal("findAll" in repository, false);
  assert.equal((await repository.findById("company-1", "product-1"))?.version, 1);
  await repository.update(state, 1);
});

test("unit of work exposes repositories only inside an atomic operation boundary", async () => {
  const repository: ProductRepository = {
    async findById() { return state; },
    async findByCode() { return state; },
    async add() {},
    async update() {},
  };
  const unitOfWork: ProductUnitOfWork = {
    async run(operation) {
      return operation({ products: repository });
    },
  };

  const version = await unitOfWork.run(async ({ products }) =>
    (await products.findById("company-1", "product-1"))?.version ?? 0,
  );
  assert.equal(version, 1);
});

test("reader contract keeps lists and selectors bounded by explicit queries", async () => {
  const reader: ProductReader = {
    async getById() { return null; },
    async getByCode() { return null; },
    async list(query) {
      return {
        items: [],
        page: query.page.page,
        pageSize: query.page.pageSize,
        totalItems: 0,
        totalPages: 0,
      };
    },
    async select(query) {
      assert.equal(query.limit <= PRODUCT_QUERY_LIMITS.maxSelectorLimit, true);
      return [];
    },
  };

  const page = await reader.list({
    filter: { companyId: "company-1" },
    page: { page: 1, pageSize: 25 },
  });
  assert.equal(page.pageSize, 25);

  await reader.select({ companyId: "company-1", limit: 10 });
});

test("application errors expose stable machine-readable codes", () => {
  const error = new ProductApplicationError(
    PRODUCT_APPLICATION_ERROR_CODES.concurrencyConflict,
  );
  assert.equal(error.code, "product.application.concurrency-conflict");
  assert.equal(error.name, "ProductApplicationError");
});
