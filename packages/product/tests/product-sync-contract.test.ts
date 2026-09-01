import assert from "node:assert/strict";
import test from "node:test";

import {
  ProductSyncContractError,
  createProductIdentifierProfile,
  createProductMasterDataProfile,
  createProductSyncTombstoneEnvelope,
  createProductSyncUpsertEnvelope,
} from "../src/index.ts";

const snapshot = {
  productId: "product-1",
  companyId: "company-1",
  code: "PRD-001",
  title: "کالای آزمایشی",
  kind: "product" as const,
  status: "active" as const,
  categoryId: null,
  purchasable: true,
  sellable: true,
  identifiers: createProductIdentifierProfile({
    sku: "SKU-001",
    taxpayerGoodsServiceId: "2720000014385",
  }),
  units: null,
  masterData: createProductMasterDataProfile({ kind: "product" }),
  createdAt: "2026-08-31T07:00:00.000Z",
  updatedAt: "2026-08-31T07:10:00.000Z",
};

const base = {
  operationId: "operation-1",
  requestId: "request-1",
  idempotencyKey: "product:company-1:product-1:v1",
  reference: {
    companyId: "company-1",
    productId: "product-1",
    displayCode: "PRD-001",
  },
  version: 1,
  changedAt: "2026-08-31T07:10:00.000Z",
};

test("creates a durable upsert envelope without transport concerns", () => {
  const envelope = createProductSyncUpsertEnvelope({
    ...base,
    snapshot,
    externalReferences: [
      { sourceSystem: "legacy-erp", externalId: "ITEM-900" },
    ],
  });

  assert.equal(envelope.entity, "product");
  assert.equal(envelope.changeKind, "upsert");
  assert.equal(envelope.reference.productId, "product-1");
  assert.equal(envelope.reference.displayCode, "PRD-001");
  assert.equal(envelope.version, 1);
  assert.equal(envelope.deletedAt, null);
  assert.equal(envelope.snapshot.productId, "product-1");
  assert.equal(envelope.externalReferences[0]?.sourceSystem, "legacy-erp");
  assert.equal("url" in envelope, false);
  assert.equal("httpMethod" in envelope, false);
  assert.equal("retryCount" in envelope, false);
});

test("keeps ordinary inactive status distinct from tombstone deletion", () => {
  const inactive = createProductSyncUpsertEnvelope({
    ...base,
    snapshot: { ...snapshot, status: "inactive" },
  });

  assert.equal(inactive.changeKind, "upsert");
  assert.equal(inactive.snapshot.status, "inactive");
  assert.equal(inactive.deletedAt, null);

  const tombstone = createProductSyncTombstoneEnvelope({
    ...base,
    operationId: "operation-2",
    requestId: "request-2",
    idempotencyKey: "product:company-1:product-1:delete:v2",
    version: 2,
    changedAt: "2026-08-31T07:20:00.000Z",
    deletedAt: "2026-08-31T07:20:00.000Z",
  });

  assert.equal(tombstone.changeKind, "tombstone");
  assert.equal(tombstone.snapshot, null);
  assert.equal(tombstone.version, 2);
});

test("rejects sync snapshots that do not match durable reference identity", () => {
  assert.throws(
    () => createProductSyncUpsertEnvelope({
      ...base,
      snapshot: { ...snapshot, productId: "product-2" },
    }),
    (error: unknown) =>
      error instanceof ProductSyncContractError &&
      error.code === "product.sync.snapshot.mismatch",
  );
});

test("requires positive safe version and operation/request/idempotency identity", () => {
  for (const input of [
    { ...base, version: 0, snapshot },
    { ...base, operationId: " ", snapshot },
    { ...base, requestId: " ", snapshot },
    { ...base, idempotencyKey: " ", snapshot },
  ]) {
    assert.throws(() => createProductSyncUpsertEnvelope(input));
  }
});

test("rejects duplicate external source references", () => {
  assert.throws(
    () => createProductSyncUpsertEnvelope({
      ...base,
      snapshot,
      externalReferences: [
        { sourceSystem: "erp", externalId: "1" },
        { sourceSystem: "erp", externalId: "1" },
      ],
    }),
    (error: unknown) =>
      error instanceof ProductSyncContractError &&
      error.code === "product.sync.external-reference.duplicate",
  );
});

test("tombstone deletion timestamp cannot be later than changedAt", () => {
  assert.throws(
    () => createProductSyncTombstoneEnvelope({
      ...base,
      version: 2,
      changedAt: "2026-08-31T07:20:00.000Z",
      deletedAt: "2026-08-31T07:21:00.000Z",
    }),
    (error: unknown) =>
      error instanceof ProductSyncContractError &&
      error.code === "product.sync.timestamp.invalid",
  );
});
