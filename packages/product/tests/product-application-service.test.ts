import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT_APPLICATION_ERROR_CODES,
  ProductApplicationError,
  ProductService,
  type ProductDuplicateCandidate,
  type ProductDuplicateDetector,
  type ProductIdempotencyExecutor,
  type ProductPersistenceState,
  type ProductReader,
  type ProductRepository,
  type ProductUnitOfWork,
} from "../src/index.ts";

class MemoryRepository implements ProductRepository {
  readonly states = new Map<string, ProductPersistenceState>();
  addCount = 0;
  updateCount = 0;

  async findById(companyId: string, productId: string) {
    const state = this.states.get(productId) ?? null;
    return state?.product.companyId === companyId ? state : null;
  }

  async findByCode(companyId: string, code: string) {
    for (const state of this.states.values()) {
      if (state.product.companyId === companyId && state.product.code === code) {
        return state;
      }
    }
    return null;
  }

  async add(state: ProductPersistenceState) {
    this.addCount += 1;
    this.states.set(state.product.productId, state);
  }

  async update(state: ProductPersistenceState, expectedVersion: number) {
    const current = this.states.get(state.product.productId);
    if (!current || current.version !== expectedVersion) {
      throw new Error("repository concurrency conflict");
    }
    this.updateCount += 1;
    this.states.set(state.product.productId, state);
  }
}

class MemoryIdempotency implements ProductIdempotencyExecutor {
  private readonly executions = new Map<string, Promise<unknown>>();

  run<T>(scope: string, requestId: string, operation: () => Promise<T>): Promise<T> {
    const key = `${scope}\u0000${requestId}`;
    const existing = this.executions.get(key);
    if (existing) {
      return existing as Promise<T>;
    }
    const execution = operation();
    this.executions.set(key, execution);
    return execution;
  }
}

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
  async select() { return []; },
};

const context = (requestId: string, occurredAt = "2026-08-31T06:00:00.000Z") => ({
  requestId,
  actorId: "user-1",
  companyId: "company-1",
  occurredAt,
});

const createService = (
  repository: MemoryRepository,
  candidates: readonly ProductDuplicateCandidate[] = [],
) => {
  const unitOfWork: ProductUnitOfWork = {
    async run(operation) {
      return operation({ products: repository });
    },
  };
  const duplicateDetector: ProductDuplicateDetector = {
    async detect() { return candidates; },
  };
  return new ProductService({
    unitOfWork,
    reader,
    duplicateDetector,
    idempotency: new MemoryIdempotency(),
  });
};

const baseCreate = (requestId: string) => ({
  context: context(requestId),
  productId: "product-1",
  code: "prd-001",
  title: "کالای آزمایشی",
  kind: "product" as const,
  identifiers: {
    sku: "sku-001",
    barcodes: ["6260000000011"],
    taxpayerGoodsServiceId: "2720000014385",
  },
});

test("advisory duplicate candidates do not block create", async () => {
  const repository = new MemoryRepository();
  const service = createService(repository, [{
    productId: "other-product",
    code: "PRD-900",
    title: "کالای آزمایشی",
    reason: "title",
    strength: "advisory",
  }]);

  const created = await service.create(baseCreate("req-create-1"));

  assert.equal(created.code, "PRD-001");
  assert.equal(created.version, 1);
  assert.equal(repository.addCount, 1);
});

test("hard identifier duplicates block create before persistence", async () => {
  const repository = new MemoryRepository();
  const service = createService(repository, [{
    productId: "other-product",
    code: "PRD-900",
    title: "Other",
    reason: "barcode",
    strength: "hard",
  }]);

  await assert.rejects(
    () => service.create(baseCreate("req-create-2")),
    (error: unknown) =>
      error instanceof ProductApplicationError &&
      error.code === PRODUCT_APPLICATION_ERROR_CODES.duplicateIdentifier,
  );
  assert.equal(repository.addCount, 0);
});

test("repository code uniqueness is a hard conflict", async () => {
  const repository = new MemoryRepository();
  const service = createService(repository);
  await service.create(baseCreate("req-create-3"));

  await assert.rejects(
    () => service.create({
      ...baseCreate("req-create-4"),
      productId: "product-2",
      code: "prd-001",
    }),
    (error: unknown) =>
      error instanceof ProductApplicationError &&
      error.code === PRODUCT_APPLICATION_ERROR_CODES.codeConflict,
  );
});

test("same request id is idempotent and does not create twice", async () => {
  const repository = new MemoryRepository();
  const service = createService(repository);
  const command = baseCreate("req-idempotent");

  const first = await service.create(command);
  const second = await service.create(command);

  assert.equal(first.productId, second.productId);
  assert.equal(repository.addCount, 1);
});

test("stale expectedVersion is rejected before repository update", async () => {
  const repository = new MemoryRepository();
  const service = createService(repository);
  await service.create(baseCreate("req-create-5"));

  await assert.rejects(
    () => service.updateIdentity({
      context: context("req-update-stale", "2026-08-31T06:05:00.000Z"),
      productId: "product-1",
      expectedVersion: 2,
      code: "PRD-001",
      title: "عنوان جدید",
      categoryId: null,
      capabilities: { purchasable: true, sellable: true },
    }),
    (error: unknown) =>
      error instanceof ProductApplicationError &&
      error.code === PRODUCT_APPLICATION_ERROR_CODES.concurrencyConflict,
  );
  assert.equal(repository.updateCount, 0);
});

test("successful mutation increments version and preserves optimistic concurrency", async () => {
  const repository = new MemoryRepository();
  const service = createService(repository);
  await service.create(baseCreate("req-create-6"));

  const updated = await service.replaceIdentifiers({
    context: context("req-identifiers", "2026-08-31T06:10:00.000Z"),
    productId: "product-1",
    expectedVersion: 1,
    identifiers: {
      sku: "SKU-002",
      barcodes: ["6260000000028"],
      taxpayerGoodsServiceId: "2720000014385",
    },
  });

  assert.equal(updated.version, 2);
  assert.equal(updated.identifiers.sku, "SKU-002");
  assert.equal(repository.updateCount, 1);
});

test("repeating the current status is a no-op without version inflation", async () => {
  const repository = new MemoryRepository();
  const service = createService(repository);
  await service.create(baseCreate("req-create-7"));

  const result = await service.setStatus({
    context: context("req-status-noop", "2026-08-31T06:15:00.000Z"),
    productId: "product-1",
    expectedVersion: 1,
    active: true,
  });

  assert.equal(result.version, 1);
  assert.equal(repository.updateCount, 0);
});
