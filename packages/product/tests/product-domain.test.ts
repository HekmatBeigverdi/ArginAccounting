import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT_DOMAIN_ERROR_CODES,
  ProductDomainError,
  activateProduct,
  assignProductCategory,
  configureProductCapabilities,
  createProduct,
  deactivateProduct,
  rehydrateProduct,
} from "../src/index.ts";

const createdAt = "2026-08-30T18:00:00.000Z";

test("creates a canonical product with durable identity and company scope", () => {
  const product = createProduct({
    productId: "product-001",
    companyId: "company-001",
    code: " p-100 ",
    title: "  کالای نمونه  ",
    kind: "product",
    createdAt,
  });

  assert.deepEqual(product, {
    productId: "product-001",
    companyId: "company-001",
    code: "P-100",
    title: "کالای نمونه",
    kind: "product",
    status: "active",
    categoryId: null,
    capabilities: { purchasable: true, sellable: true },
    createdAt,
    updatedAt: createdAt,
  });
  assert.equal(Object.isFrozen(product), true);
  assert.equal(Object.isFrozen(product.capabilities), true);
});

test("represents a service in the same canonical master-data boundary", () => {
  const service = createProduct({
    productId: "service-001",
    companyId: "company-001",
    code: "S-001",
    title: "خدمات نصب",
    kind: "service",
    capabilities: { purchasable: false, sellable: true },
    createdAt,
  });

  assert.equal(service.kind, "service");
  assert.equal(service.status, "active");
  assert.deepEqual(service.capabilities, { purchasable: false, sellable: true });
});

test("keeps durable identity distinct from display code", () => {
  const product = createProduct({
    productId: "01J-DURABLE-ID",
    companyId: "company-001",
    code: "10001",
    title: "محصول",
    kind: "product",
    createdAt,
  });

  assert.notEqual(product.productId, product.code);
});

test("rejects missing required aggregate invariants", () => {
  assert.throws(
    () =>
      createProduct({
        productId: " ",
        companyId: "company-001",
        code: "P-1",
        title: "محصول",
        kind: "product",
        createdAt,
      }),
    (error: unknown) =>
      error instanceof ProductDomainError &&
      error.code === PRODUCT_DOMAIN_ERROR_CODES.idRequired,
  );

  assert.throws(
    () =>
      createProduct({
        productId: "product-001",
        companyId: " ",
        code: "P-1",
        title: "محصول",
        kind: "product",
        createdAt,
      }),
    (error: unknown) =>
      error instanceof ProductDomainError &&
      error.code === PRODUCT_DOMAIN_ERROR_CODES.companyIdRequired,
  );
});

test("rejects an invalid product/service classification", () => {
  assert.throws(
    () =>
      createProduct({
        productId: "product-001",
        companyId: "company-001",
        code: "P-1",
        title: "محصول",
        kind: "inventory-item" as never,
        createdAt,
      }),
    (error: unknown) =>
      error instanceof ProductDomainError &&
      error.code === PRODUCT_DOMAIN_ERROR_CODES.kindInvalid,
  );
});

test("supports explicit category assignment without embedding category persistence", () => {
  const product = createProduct({
    productId: "product-001",
    companyId: "company-001",
    code: "P-1",
    title: "محصول",
    kind: "product",
    createdAt,
  });

  const categorized = assignProductCategory(
    product,
    " category-general ",
    "2026-08-30T18:30:00.000Z",
  );

  assert.equal(categorized.categoryId, "category-general");
  assert.equal(categorized.updatedAt, "2026-08-30T18:30:00.000Z");
  assert.strictEqual(
    assignProductCategory(categorized, "category-general", "2026-08-30T19:00:00.000Z"),
    categorized,
  );
  assert.equal(
    assignProductCategory(categorized, null, "2026-08-30T19:00:00.000Z").categoryId,
    null,
  );
});

test("supports safe active and inactive lifecycle transitions", () => {
  const product = createProduct({
    productId: "product-001",
    companyId: "company-001",
    code: "P-1",
    title: "محصول",
    kind: "product",
    createdAt,
  });

  const inactive = deactivateProduct(product, "2026-08-30T18:30:00.000Z");
  assert.equal(inactive.status, "inactive");
  assert.strictEqual(
    deactivateProduct(inactive, "2026-08-30T19:00:00.000Z"),
    inactive,
  );

  const activeAgain = activateProduct(inactive, "2026-08-30T19:00:00.000Z");
  assert.equal(activeAgain.status, "active");
  assert.strictEqual(
    activateProduct(activeAgain, "2026-08-30T19:30:00.000Z"),
    activeAgain,
  );
});

test("configures purchase and sales capabilities as master-data flags only", () => {
  const product = createProduct({
    productId: "product-001",
    companyId: "company-001",
    code: "P-1",
    title: "محصول",
    kind: "product",
    createdAt,
  });

  const configured = configureProductCapabilities(
    product,
    { purchasable: false, sellable: true },
    "2026-08-30T18:15:00.000Z",
  );

  assert.deepEqual(configured.capabilities, {
    purchasable: false,
    sellable: true,
  });
  assert.strictEqual(
    configureProductCapabilities(
      configured,
      { purchasable: false, sellable: true },
      "2026-08-30T19:00:00.000Z",
    ),
    configured,
  );
});

test("lifecycle mutation timestamps cannot move backwards", () => {
  const product = createProduct({
    productId: "product-001",
    companyId: "company-001",
    code: "P-1",
    title: "محصول",
    kind: "product",
    createdAt,
  });

  assert.throws(
    () => deactivateProduct(product, "2026-08-29T18:00:00.000Z"),
    (error: unknown) =>
      error instanceof ProductDomainError &&
      error.code === PRODUCT_DOMAIN_ERROR_CODES.timestampOrderInvalid,
  );
});

test("rehydration validates timestamps and preserves business lifecycle independently of tombstones", () => {
  const product = rehydrateProduct({
    productId: "product-001",
    companyId: "company-001",
    code: "P-1",
    title: "محصول",
    kind: "product",
    status: "inactive",
    categoryId: "category-1",
    capabilities: { purchasable: true, sellable: false },
    createdAt,
    updatedAt: "2026-08-30T19:00:00.000Z",
  });

  assert.equal(product.status, "inactive");
  assert.equal(product.categoryId, "category-1");
  assert.equal(Object.isFrozen(product), true);
  assert.equal("deleted" in product, false);
  assert.equal("tombstone" in product, false);

  assert.throws(
    () =>
      rehydrateProduct({
        ...product,
        updatedAt: "2026-08-29T18:00:00.000Z",
      }),
    (error: unknown) =>
      error instanceof ProductDomainError &&
      error.code === PRODUCT_DOMAIN_ERROR_CODES.timestampOrderInvalid,
  );
});
