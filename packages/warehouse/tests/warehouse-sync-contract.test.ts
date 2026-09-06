import assert from "node:assert/strict";
import test from "node:test";

import {
  WarehouseSyncContractError,
  createWarehouseSyncTombstoneEnvelope,
  createWarehouseSyncUpsertEnvelope,
  type WarehouseSyncSnapshot,
} from "../src/index.ts";

const snapshot: WarehouseSyncSnapshot = {
  warehouseId: "warehouse-1",
  companyId: "company-1",
  code: "WH-01",
  title: "Main Warehouse",
  description: null,
  kind: "general",
  status: "active",
  organizationalScope: Object.freeze({ mode: "company" }),
  externalIdentifiers: Object.freeze([
    Object.freeze({ namespace: "ERP", value: "W-100" }),
  ]),
  createdAt: "2026-09-04T10:00:00.000Z",
  updatedAt: "2026-09-04T11:00:00.000Z",
};

const base = {
  operationId: "op-1",
  requestId: "req-1",
  idempotencyKey: "warehouse:company-1:warehouse-1:v2",
  reference: {
    companyId: "company-1",
    warehouseId: "warehouse-1",
    displayCode: "WH-01",
  },
  version: 2,
  serverRevision: null,
  changedAt: "2026-09-04T11:00:00.000Z",
  origin: {
    sourceSystem: "argin-desktop",
    sourceInstanceId: "desktop-1",
  },
};

test("creates immutable warehouse upsert envelope", () => {
  const envelope = createWarehouseSyncUpsertEnvelope({
    ...base,
    snapshot,
    externalReferences: [
      { sourceSystem: "legacy-erp", externalId: "OLD-WH-1" },
    ],
  });

  assert.equal(envelope.entity, "warehouse");
  assert.equal(envelope.changeKind, "upsert");
  assert.equal(envelope.deletedAt, null);
  assert.equal(envelope.version, 2);
  assert.equal(envelope.serverRevision, null);
  assert.equal(envelope.origin.sourceSystem, "argin-desktop");
  assert.equal(Object.isFrozen(envelope), true);
  assert.equal(Object.isFrozen(envelope.snapshot), true);
  assert.equal(Object.isFrozen(envelope.externalReferences), true);
});

test("supports positive future server revision", () => {
  const envelope = createWarehouseSyncUpsertEnvelope({
    ...base,
    serverRevision: 41,
    snapshot,
  });
  assert.equal(envelope.serverRevision, 41);
});

test("rejects invalid server revision and missing origin", () => {
  assert.throws(
    () => createWarehouseSyncUpsertEnvelope({ ...base, serverRevision: 0, snapshot }),
    (error) => error instanceof WarehouseSyncContractError &&
      error.code === "warehouse.sync.server-revision.invalid",
  );

  assert.throws(
    () => createWarehouseSyncUpsertEnvelope({
      ...base,
      origin: { sourceSystem: " ", sourceInstanceId: null },
      snapshot,
    }),
    (error) => error instanceof WarehouseSyncContractError &&
      error.code === "warehouse.sync.origin.invalid",
  );
});

test("rejects snapshot/reference mismatch", () => {
  assert.throws(
    () => createWarehouseSyncUpsertEnvelope({
      ...base,
      snapshot: { ...snapshot, warehouseId: "warehouse-other" },
    }),
    (error) => error instanceof WarehouseSyncContractError &&
      error.code === "warehouse.sync.snapshot.mismatch",
  );
});

test("rejects duplicate external source mapping case-insensitively", () => {
  assert.throws(
    () => createWarehouseSyncUpsertEnvelope({
      ...base,
      snapshot,
      externalReferences: [
        { sourceSystem: "ERP", externalId: "X-1" },
        { sourceSystem: "erp", externalId: "X-1" },
      ],
    }),
    (error) => error instanceof WarehouseSyncContractError &&
      error.code === "warehouse.sync.external-reference.duplicate",
  );
});

test("creates tombstone without business snapshot", () => {
  const envelope = createWarehouseSyncTombstoneEnvelope({
    ...base,
    changedAt: "2026-09-04T12:00:00.000Z",
    deletedAt: "2026-09-04T11:30:00.000Z",
  });

  assert.equal(envelope.changeKind, "tombstone");
  assert.equal(envelope.snapshot, null);
  assert.equal(envelope.deletedAt, "2026-09-04T11:30:00.000Z");
});

test("archive remains business lifecycle and is not a tombstone", () => {
  const envelope = createWarehouseSyncUpsertEnvelope({
    ...base,
    snapshot: { ...snapshot, status: "archived" },
  });
  assert.equal(envelope.changeKind, "upsert");
  assert.equal(envelope.snapshot.status, "archived");
});
