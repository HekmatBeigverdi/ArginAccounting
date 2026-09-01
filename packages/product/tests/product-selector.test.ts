import assert from "node:assert/strict";
import test from "node:test";

import {
  ProductApplicationError,
  ProductSelectorService,
  SecuredProductSelectorService,
  createProductSelectorQuery,
  productPermissions,
  type ProductAuthorizationPolicy,
  type ProductSelectorItemDto,
  type ProductSelectorQuery,
} from "../src/index.ts";

const item: ProductSelectorItemDto = Object.freeze({
  productId: "product-1",
  code: "P-001",
  title: "کالای نمونه",
  kind: "product",
  status: "active",
  purchasable: true,
  sellable: true,
  defaultPurchaseUnitId: "unit-kg",
  defaultSalesUnitId: "unit-kg",
  taxpayerGoodsServiceId: "2720000014385",
});

test("selector usage profiles translate to bounded downstream filters", () => {
  assert.deepEqual(createProductSelectorQuery({ companyId: "company-1", usage: "inventory" }), {
    companyId: "company-1",
    search: null,
    kinds: ["product"],
    statuses: ["active"],
    stockTracking: true,
    limit: 20,
  });

  assert.deepEqual(createProductSelectorQuery({ companyId: "company-1", usage: "purchase", limit: 25 }), {
    companyId: "company-1",
    search: null,
    statuses: ["active"],
    purchasable: true,
    limit: 25,
  });

  assert.deepEqual(createProductSelectorQuery({ companyId: "company-1", usage: "sales" }), {
    companyId: "company-1",
    search: null,
    statuses: ["active"],
    sellable: true,
    limit: 20,
  });

  assert.deepEqual(createProductSelectorQuery({ companyId: "company-1", usage: "taxpayer" }), {
    companyId: "company-1",
    search: null,
    statuses: ["active"],
    requiresTaxpayerGoodsServiceId: true,
    limit: 20,
  });
});

test("consumer filters cannot relax mandatory usage constraints", () => {
  const query = createProductSelectorQuery({
    companyId: "company-1",
    usage: "inventory",
    kinds: ["service"],
    statuses: ["inactive"],
  });
  assert.deepEqual(query.kinds, []);
  assert.deepEqual(query.statuses, []);
  assert.equal(query.stockTracking, true);
});

test("selector returns durable product identity separately from display code", async () => {
  const capturedQueries: ProductSelectorQuery[] = [];
  const service = new ProductSelectorService({
    select: async (query) => {
      capturedQueries.push(query);
      return [item];
    },
  });

  const result = await service.search({ companyId: "company-1", usage: "sales", search: "P-001" });
  assert.equal(result[0]?.durableId, "product-1");
  assert.equal(result[0]?.productId, "product-1");
  assert.equal(result[0]?.code, "P-001");
  assert.equal(capturedQueries[0]?.sellable, true);
});

test("secured selector enforces view permission and company scope", async () => {
  const required: string[] = [];
  const authorization: ProductAuthorizationPolicy = {
    require: async (_context, permission) => {
      required.push(permission);
    },
  };
  const secured = new SecuredProductSelectorService(
    new ProductSelectorService({ select: async () => [item] }),
    authorization,
  );

  const result = await secured.search(
    { actorId: "user-1", companyId: "company-1", correlationId: "corr-1", requestId: "req-1" },
    { companyId: "company-1", usage: "general" },
  );
  assert.equal(result.length, 1);
  assert.deepEqual(required, [productPermissions.view]);

  await assert.rejects(
    () => secured.search(
      { actorId: "user-1", companyId: "company-2", correlationId: "corr-2", requestId: "req-2" },
      { companyId: "company-1", usage: "general" },
    ),
    (error: unknown) => error instanceof ProductApplicationError
      && error.code === "product.application.invalid-request",
  );
});

test("selector rejects unbounded limits", () => {
  assert.throws(
    () => createProductSelectorQuery({ companyId: "company-1", usage: "general", limit: 101 }),
    (error: unknown) => error instanceof ProductApplicationError
      && error.code === "product.application.invalid-request",
  );
});
