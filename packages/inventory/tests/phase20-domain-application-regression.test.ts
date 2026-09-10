import assert from "node:assert/strict";
import test from "node:test";
import {
  INVENTORY_DOMAIN_ERROR_CODES,
  InventoryDomainError,
  InventorySyncContractError,
  addInventoryStockQuantities,
  createInventoryDocumentSyncTombstoneEnvelope,
  createInventoryMovementBatchSyncEnvelope,
  createInventoryStockMovement,
  rebuildInventoryStockLedger,
} from "../src/index.ts";

const changedAt = "2026-09-10T12:00:00Z";
const metadata = {
  operationId: "operation-1",
  requestId: "request-1",
  idempotencyKey: "idempotency-1",
  payloadFingerprint: "sha256:payload",
  changedAt,
  origin: { sourceSystem: "argin-desktop", sourceInstanceId: "desktop-1" },
} as const;

function movement(input: {
  movementId: string;
  documentId: string;
  lineId?: string;
  warehouseId?: string;
  businessDate: string;
  businessOrder: number;
  quantityDelta: string;
  transferId?: string | null;
  reversalOfMovementId?: string | null;
}) {
  return createInventoryStockMovement({
    movementId: input.movementId,
    companyId: "company-1",
    documentId: input.documentId,
    lineId: input.lineId ?? "line-1",
    productId: "product-1",
    warehouse: { warehouseId: input.warehouseId ?? "warehouse-1" },
    businessDate: input.businessDate,
    businessOrder: input.businessOrder,
    recordedAt: "2026-09-10T10:00:00Z",
    transferId: input.transferId ?? null,
    reversalOfMovementId: input.reversalOfMovementId ?? null,
    quantityDelta: input.quantityDelta,
  });
}

test("exact quantity arithmetic preserves large values and long fractional tails", () => {
  assert.equal(
    addInventoryStockQuantities(
      "12345678901234567890.000000000000000001",
      "0.000000000000000009",
    ),
    "12345678901234567890.00000000000000001",
  );
  assert.equal(addInventoryStockQuantities("10000000000000000000.1", "-0.1"), "10000000000000000000");
});

test("a backdated issue is rejected when historical chronology becomes negative even if final net stock would be positive", () => {
  const lateReceipt = movement({
    movementId: "receipt-late",
    documentId: "receipt-doc",
    businessDate: "2026-09-10",
    businessOrder: 1,
    quantityDelta: "5",
  });
  const backdatedIssue = movement({
    movementId: "issue-backdated",
    documentId: "issue-doc",
    businessDate: "2026-09-09",
    businessOrder: 1,
    quantityDelta: "-1",
  });

  assert.throws(
    () => rebuildInventoryStockLedger([lateReceipt, backdatedIssue]),
    (error: unknown) =>
      error instanceof InventoryDomainError && error.code === INVENTORY_DOMAIN_ERROR_CODES.negativeStock,
  );
});

test("Bridge transfer batch requires two distinct stock facts per line and exact conservation", () => {
  const batchId = "transfer-1";
  const source = movement({
    movementId: "transfer-source",
    documentId: "transfer-doc",
    warehouseId: "warehouse-1",
    businessDate: "2026-09-10",
    businessOrder: 2,
    quantityDelta: "-2.500",
    transferId: batchId,
  });
  const destination = movement({
    movementId: "transfer-destination",
    documentId: "transfer-doc",
    warehouseId: "warehouse-2",
    businessDate: "2026-09-10",
    businessOrder: 2,
    quantityDelta: "2.5",
    transferId: batchId,
  });

  const envelope = createInventoryMovementBatchSyncEnvelope({
    ...metadata,
    batchId,
    batchKind: "transfer",
    ownerDocumentId: "transfer-doc",
    effectDocumentId: "transfer-doc",
    localVersion: 4,
    companyId: "company-1",
    movements: [source, destination],
  });

  assert.equal(envelope.movements.length, 2);
  assert.deepEqual(envelope.dependencies, [{ entity: "inventory-document", id: "transfer-doc" }]);

  const unbalanced = movement({
    movementId: "transfer-destination-bad",
    documentId: "transfer-doc",
    warehouseId: "warehouse-2",
    businessDate: "2026-09-10",
    businessOrder: 2,
    quantityDelta: "2.499",
    transferId: batchId,
  });
  assert.throws(
    () => createInventoryMovementBatchSyncEnvelope({
      ...metadata,
      batchId,
      batchKind: "transfer",
      ownerDocumentId: "transfer-doc",
      effectDocumentId: "transfer-doc",
      localVersion: 4,
      companyId: "company-1",
      movements: [source, unbalanced],
    }),
    (error: unknown) =>
      error instanceof InventorySyncContractError &&
      error.code === "inventory.sync.transfer-conservation-invalid",
  );
});

test("Bridge reversal batch depends on the original document and every neutralized movement", () => {
  const reversal = movement({
    movementId: "reversal-fact-1",
    documentId: "reversal-doc",
    businessDate: "2026-09-10",
    businessOrder: 3,
    quantityDelta: "-3",
    reversalOfMovementId: "original-movement-1",
  });

  const envelope = createInventoryMovementBatchSyncEnvelope({
    ...metadata,
    batchId: "reversal-doc",
    batchKind: "reversal",
    ownerDocumentId: "original-doc",
    effectDocumentId: "reversal-doc",
    localVersion: 6,
    companyId: "company-1",
    movements: [reversal],
  });

  assert.deepEqual(envelope.dependencies, [
    { entity: "inventory-document", id: "original-doc" },
    { entity: "inventory-movement", id: "original-movement-1" },
  ]);
});

test("Bridge tombstones are limited to deleted Draft documents", () => {
  assert.throws(
    () => createInventoryDocumentSyncTombstoneEnvelope({
      ...metadata,
      reference: { companyId: "company-1", documentId: "confirmed-doc", documentNumber: "INV-1" },
      localVersion: 5,
      lastKnownStatus: "confirmed",
      deletedAt: "2026-09-10T11:00:00Z",
    }),
    (error: unknown) =>
      error instanceof InventorySyncContractError && error.code === "inventory.sync.tombstone-invalid",
  );
});
