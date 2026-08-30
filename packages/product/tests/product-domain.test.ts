import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT_DOMAIN_ERROR_CODES,
  ProductDomainError,
  createProduct,
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
    createdAt,
    updatedAt: createdAt,
  });
  assert.equal(Object.isFrozen(product), true);
});

test("represents a service in the same canonical master-data boundary", () => {
  const service = createProduct({
    productId: "service-001",
    companyId: "company-001",
    code: "S-001",
    title: "خدمات نصب",
    kind: "service",
    createdAt,
  });

  assert.equal(service.kind, "service");
  assert.equal(service.status, "active");
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

test("rehydration validates timestamps and preserves persisted status without defining lifecycle transitions", () => {
  const product = rehydrateProduct({
    productId: "product-001",
    companyId: "company-001",
    code: "P-1",
    title: "محصول",
    kind: "product",
    status: "inactive",
    createdAt,
    updatedAt: "2026-08-30T19:00:00.000Z",
  });

  assert.equal(product.status, "inactive");
  assert.equal(Object.isFrozen(product), true);

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
