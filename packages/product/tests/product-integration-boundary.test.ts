import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ProductSelectorService,
  type ProductSelectorItemDto,
} from "../src/index.ts";

test("Product package keeps shared infrastructure and downstream ERP modules out of the bounded context", () => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { dependencies?: Record<string, string> };
  const dependencies = packageJson.dependencies ?? {};

  for (const forbidden of [
    "@argin/database-tauri",
    "@argin/audit",
    "@argin/audit-tauri",
    "@argin/security",
    "@argin/party",
    "@argin/accounting",
    "@argin/accounting-tauri",
    "@argin/inventory",
    "@argin/purchase",
    "@argin/sales",
  ]) {
    assert.equal(dependencies[forbidden], undefined, `${forbidden} must not be a Product dependency`);
  }
});

test("future ERP consumers reference durable Product identity rather than display code", async () => {
  const item: ProductSelectorItemDto = Object.freeze({
    productId: "product-stable-id",
    code: "P-1001",
    title: "کالای نمونه",
    kind: "product",
    status: "active",
    purchasable: true,
    sellable: true,
    defaultPurchaseUnitId: null,
    defaultSalesUnitId: null,
    taxpayerGoodsServiceId: "2720000014385",
  });

  const selector = new ProductSelectorService({
    select: async () => Object.freeze([item]),
  });

  const [reference] = await selector.search({
    companyId: "company-1",
    usage: "general",
    limit: 20,
  });

  assert.ok(reference);
  assert.equal(reference.durableId, "product-stable-id");
  assert.equal(reference.productId, "product-stable-id");
  assert.equal(reference.code, "P-1001");
  assert.notEqual(reference.productId, reference.code);
});

test("Product Master Data contract does not expose stock balances, document totals, postings, or prices", async () => {
  const item: ProductSelectorItemDto = Object.freeze({
    productId: "product-stable-id",
    code: "P-1001",
    title: "کالای نمونه",
    kind: "product",
    status: "active",
    purchasable: true,
    sellable: true,
    defaultPurchaseUnitId: null,
    defaultSalesUnitId: null,
    taxpayerGoodsServiceId: null,
  });

  const forbiddenKeys = [
    "quantityOnHand",
    "inventoryBalance",
    "valuation",
    "purchasePrice",
    "salesPrice",
    "accountId",
    "journalVoucherId",
    "warehouseId",
    "documentTotal",
  ];

  for (const key of forbiddenKeys) {
    assert.equal(key in item, false, `${key} belongs to a downstream owning module`);
  }
});
