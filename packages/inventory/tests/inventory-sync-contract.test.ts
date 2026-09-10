import assert from "node:assert/strict";
import test from "node:test";
import {
  InventorySyncContractError,
  createInventoryDocument,
  createInventoryDocumentSyncTombstoneEnvelope,
  createInventoryDocumentSyncUpsertEnvelope,
  createInventoryMovementBatchSyncEnvelope,
  createInventoryStockMovement,
} from "../src/index.ts";

const changedAt = "2026-09-08T08:30:00Z";
const metadata = {
  operationId: "op-1",
  requestId: "req-1",
  idempotencyKey: "idem-1",
  payloadFingerprint: "sha256:abc",
  changedAt,
  origin: { sourceSystem: "argin-desktop", sourceInstanceId: "device-1" },
} as const;

const draft = createInventoryDocument({
  documentId: "doc-1",
  companyId: "company-1",
  documentType: "receipt",
  documentNumber: null,
  businessDate: "2026-09-08",
  createdAt: "2026-09-08T08:00:00Z",
});

const movement = (input: {
  movementId: string;
  documentId?: string;
  lineId?: string;
  warehouseId: string;
  quantityDelta: string;
  transferId?: string | null;
  reversalOfMovementId?: string | null;
}) => createInventoryStockMovement({
  movementId: input.movementId,
  companyId: "company-1",
  documentId: input.documentId ?? "doc-1",
  lineId: input.lineId ?? "line-1",
  productId: "product-1",
  warehouse: { warehouseId: input.warehouseId, zoneId: null, locationId: null },
  businessDate: "2026-09-08",
  businessOrder: 1,
  recordedAt: "2026-09-08T08:10:00Z",
  quantityDelta: input.quantityDelta,
  ...(input.transferId === undefined ? {} : { transferId: input.transferId }),
  ...(input.reversalOfMovementId === undefined ? {} : { reversalOfMovementId: input.reversalOfMovementId }),
});

test("document upsert carries stable contract version and local version", () => {
  const envelope = createInventoryDocumentSyncUpsertEnvelope({
    ...metadata,
    reference: { companyId: "company-1", documentId: "doc-1", documentNumber: null },
    snapshot: draft,
  });
  assert.equal(envelope.contractVersion, 1);
  assert.equal(envelope.localVersion, 1);
  assert.equal(envelope.changeKind, "upsert");
  assert.equal(envelope.snapshot.documentId, "doc-1");
});

test("only Draft documents may produce tombstones", () => {
  assert.throws(
    () => createInventoryDocumentSyncTombstoneEnvelope({
      ...metadata,
      reference: { companyId: "company-1", documentId: "doc-1", documentNumber: null },
      localVersion: 2,
      lastKnownStatus: "confirmed",
      deletedAt: "2026-09-08T08:20:00Z",
    }),
    (error: unknown) => error instanceof InventorySyncContractError && error.code === "inventory.sync.tombstone-invalid",
  );
});

test("regular confirmation batch contains immutable facts and document dependency", () => {
  const envelope = createInventoryMovementBatchSyncEnvelope({
    ...metadata,
    batchId: "doc-1",
    batchKind: "confirmation",
    ownerDocumentId: "doc-1",
    effectDocumentId: "doc-1",
    localVersion: 4,
    companyId: "company-1",
    movements: [movement({ movementId: "m-1", warehouseId: "w-1", quantityDelta: "5" })],
  });
  assert.equal(envelope.movements.length, 1);
  assert.deepEqual(envelope.dependencies, [{ entity: "inventory-document", id: "doc-1" }]);
});

test("transfer batch requires both conserved sides under one transfer identity", () => {
  const envelope = createInventoryMovementBatchSyncEnvelope({
    ...metadata,
    batchId: "transfer-1",
    batchKind: "transfer",
    ownerDocumentId: "doc-1",
    effectDocumentId: "doc-1",
    localVersion: 4,
    companyId: "company-1",
    movements: [
      movement({ movementId: "m-out", lineId: "line-1", warehouseId: "w-1", quantityDelta: "-2", transferId: "transfer-1" }),
      movement({ movementId: "m-in", lineId: "line-1", warehouseId: "w-2", quantityDelta: "2", transferId: "transfer-1" }),
    ],
  });
  assert.equal(envelope.batchKind, "transfer");
  assert.equal(envelope.movements.length, 2);
});

test("half transfer or non-conserved transfer is rejected", () => {
  assert.throws(
    () => createInventoryMovementBatchSyncEnvelope({
      ...metadata,
      batchId: "transfer-1",
      batchKind: "transfer",
      ownerDocumentId: "doc-1",
      effectDocumentId: "doc-1",
      localVersion: 4,
      companyId: "company-1",
      movements: [movement({ movementId: "m-out", warehouseId: "w-1", quantityDelta: "-2", transferId: "transfer-1" })],
    }),
    InventorySyncContractError,
  );
});

test("reversal batch depends on original movement facts and cannot masquerade as a regular confirmation", () => {
  const envelope = createInventoryMovementBatchSyncEnvelope({
    ...metadata,
    batchId: "reversal-1",
    batchKind: "reversal",
    ownerDocumentId: "doc-original",
    effectDocumentId: "reversal-1",
    localVersion: 5,
    companyId: "company-1",
    movements: [movement({
      movementId: "m-reversal",
      documentId: "reversal-1",
      warehouseId: "w-1",
      quantityDelta: "-5",
      reversalOfMovementId: "m-original",
    })],
  });
  assert.deepEqual(envelope.dependencies, [
    { entity: "inventory-document", id: "doc-original" },
    { entity: "inventory-movement", id: "m-original" },
  ]);
});

test("same logical envelope identity must carry a non-empty payload fingerprint", () => {
  assert.throws(
    () => createInventoryDocumentSyncUpsertEnvelope({
      ...metadata,
      payloadFingerprint: " ",
      reference: { companyId: "company-1", documentId: "doc-1", documentNumber: null },
      snapshot: draft,
    }),
    InventorySyncContractError,
  );
});
