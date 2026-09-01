import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT_APPLICATION_ERROR_CODES,
  ProductApplicationError,
  ProductService,
  type ProductDuplicateDetector,
  type ProductIdempotencyExecutor,
  type ProductPersistenceState,
  type ProductReader,
  type ProductRepository,
  type ProductUnitOfWork,
} from "../src/index.ts";

class MemoryRepository implements ProductRepository {
  readonly states = new Map<string, ProductPersistenceState>();
  updates: Array<{ state: ProductPersistenceState; expectedVersion: number }> = [];

  async findById(companyId: string, productId: string) {
    const state = this.states.get(productId) ?? null;
    return state?.product.companyId === companyId ? state : null;
  }

  async findByCode(companyId: string, code: string) {
    for (const state of this.states.values()) {
      if (state.product.companyId === companyId && state.product.code === code) return state;
    }
    return null;
  }

  async add(state: ProductPersistenceState) {
    this.states.set(state.product.productId, state);
  }

  async update(state: ProductPersistenceState, expectedVersion: number) {
    const current = this.states.get(state.product.productId);
    if (!current || current.version !== expectedVersion) {
      throw new ProductApplicationError(PRODUCT_APPLICATION_ERROR_CODES.concurrencyConflict);
    }
    this.updates.push({ state, expectedVersion });
    this.states.set(state.product.productId, state);
  }
}

class MemoryIdempotency implements ProductIdempotencyExecutor {
  readonly keys: string[] = [];
  private readonly completed = new Map<string, unknown>();

  async run<T>(scope: string, requestId: string, operation: () => Promise<T>): Promise<T> {
    const key = `${scope}\u0000${requestId}`;
    this.keys.push(key);
    if (this.completed.has(key)) return this.completed.get(key) as T;
    const result = await operation();
    this.completed.set(key, result);
    return result;
  }
}

const nullReader: ProductReader = {
  async getById() { return null; },
  async getByCode() { return null; },
  async list(query) {
    return { items: [], page: query.page.page, pageSize: query.page.pageSize, totalItems: 0, totalPages: 0 };
  },
  async select() { return []; },
};

function context(companyId: string, requestId: string, occurredAt: string) {
  return { companyId, requestId, actorId: "user-1", occurredAt };
}

function createHarness() {
  const repository = new MemoryRepository();
  const idempotency = new MemoryIdempotency();
  const unitOfWork: ProductUnitOfWork = {
    async run(operation) { return operation({ products: repository }); },
  };
  const duplicateDetector: ProductDuplicateDetector = { async detect() { return []; } };
  const service = new ProductService({
    unitOfWork,
    reader: nullReader,
    duplicateDetector,
    idempotency,
    taxpayerUnitReferences: { async isActiveCode() { return true; } },
  });
  return { repository, idempotency, service };
}

const createProductCommand = (companyId: string, requestId: string, productId: string) => ({
  context: context(companyId, requestId, "2026-09-01T07:10:00.000Z"),
  productId,
  code: `prd-${productId}`,
  title: `Product ${productId}`,
  kind: "product" as const,
});

test("company isolation treats an existing Product from another company as not found", async () => {
  const { service } = createHarness();
  await service.create(createProductCommand("company-a", "create-a", "shared-id"));

  await assert.rejects(
    () => service.updateIdentity({
      context: context("company-b", "update-b", "2026-09-01T07:11:00.000Z"),
      productId: "shared-id",
      expectedVersion: 1,
      code: "PRD-OTHER",
      title: "Other company",
      categoryId: null,
      capabilities: { purchasable: true, sellable: true },
    }),
    (error: unknown) => error instanceof ProductApplicationError && error.code === PRODUCT_APPLICATION_ERROR_CODES.notFound,
  );
});

test("idempotency scopes include company and mutation target so request ids cannot collide across Products", async () => {
  const { service, idempotency } = createHarness();
  await service.create(createProductCommand("company-a", "same-request", "p1"));
  await service.create(createProductCommand("company-b", "same-request", "p2"));

  assert.ok(idempotency.keys.includes("product:create:company-a\u0000same-request"));
  assert.ok(idempotency.keys.includes("product:create:company-b\u0000same-request"));
});

test("all supported update families carry the returned optimistic version forward", async () => {
  const { service, repository } = createHarness();
  let current = await service.create(createProductCommand("company-a", "create", "p1"));

  current = await service.updateIdentity({
    context: context("company-a", "identity", "2026-09-01T07:11:00.000Z"),
    productId: current.productId,
    expectedVersion: current.version,
    code: "PRD-UPDATED",
    title: "Updated",
    categoryId: "category-1",
    capabilities: { purchasable: true, sellable: false },
  });
  assert.equal(current.version, 2);

  current = await service.replaceUnits({
    context: context("company-a", "units", "2026-09-01T07:12:00.000Z"),
    productId: current.productId,
    expectedVersion: current.version,
    units: {
      baseUnit: {
        unitId: "unit-each",
        code: "EA",
        title: "Each",
        precision: 0,
        roundingMode: "half-up" as const,
        taxpayerUnitCode: "164",
      },
    },
  });
  assert.equal(current.version, 3);

  current = await service.replaceMasterData({
    context: context("company-a", "master", "2026-09-01T07:13:00.000Z"),
    productId: current.productId,
    expectedVersion: current.version,
    masterData: {
      commercial: { defaultSalesUnitId: "unit-each" },
      tax: { treatment: "taxable", vatRateBasisPoints: 1000 },
      operational: { stockTracking: true },
    },
  });
  assert.equal(current.version, 4);

  current = await service.setStatus({
    context: context("company-a", "status", "2026-09-01T07:14:00.000Z"),
    productId: current.productId,
    expectedVersion: current.version,
    active: false,
  });
  assert.equal(current.version, 5);
  assert.equal(current.status, "inactive");
  assert.deepEqual(repository.updates.map((entry) => entry.expectedVersion), [1, 2, 3, 4]);
});

test("invalid request context is rejected before Unit of Work execution", async () => {
  const { service, repository } = createHarness();
  await assert.rejects(
    () => service.create({
      ...createProductCommand("company-a", "bad-context", "p1"),
      context: { companyId: "company-a", requestId: " ", actorId: "user-1", occurredAt: "not-a-date" },
    }),
    (error: unknown) => error instanceof ProductApplicationError && error.code === PRODUCT_APPLICATION_ERROR_CODES.invalidRequest,
  );
  assert.equal(repository.states.size, 0);
});

test("removing units is blocked while master-data defaults still reference them", async () => {
  const { service } = createHarness();
  let current = await service.create({
    ...createProductCommand("company-a", "create-with-unit", "p1"),
    units: {
      baseUnit: {
        unitId: "unit-each",
        code: "EA",
        title: "Each",
        precision: 0,
        roundingMode: "half-up" as const,
        taxpayerUnitCode: "164",
      },
    },
    masterData: { commercial: { defaultPurchaseUnitId: "unit-each" } },
  });

  await assert.rejects(
    () => service.replaceUnits({
      context: context("company-a", "remove-units", "2026-09-01T07:15:00.000Z"),
      productId: current.productId,
      expectedVersion: current.version,
      units: null,
    }),
    (error: unknown) => error instanceof ProductApplicationError && error.code === PRODUCT_APPLICATION_ERROR_CODES.unitReferenceInvalid,
  );
});
