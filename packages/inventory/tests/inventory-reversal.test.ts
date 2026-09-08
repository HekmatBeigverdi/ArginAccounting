import assert from "node:assert/strict";
import test from "node:test";
import {
  INVENTORY_DOMAIN_ERROR_CODES as codes,
  InventoryDomainError,
  approveInventoryDocument,
  confirmInventoryDocument,
  createInventoryDocument,
  createInventoryStockKey,
  createInventoryStockMovement,
  getInventoryStockBalance,
  rebuildInventoryStockLedger,
  reverseInventoryStockEffects,
  submitInventoryDocument,
} from "../src/index.ts";
import type { InventoryDomainErrorCode } from "../src/index.ts";

const companyId = "company-1";
const createdAt = "2026-09-08T08:00:00Z";
const actorUserId = "user-1";

function confirmedDocument(documentId = "receipt-1") {
  let document = createInventoryDocument({
    documentId,
    companyId,
    documentType: "receipt",
    documentNumber: "000001",
    businessDate: "2026-09-08",
    scope: { fiscalYearId: "fy-2026", fiscalPeriodId: "fp-09" },
    lines: [{
      lineId: "line-1",
      position: 1,
      productId: "product-1",
      operation: {
        companyId,
        productId: "product-1",
        productVersion: 1,
        quantity: {
          enteredQuantity: "10",
          baseQuantity: "10",
          enteredUnit: { unitId: "unit", code: "EA", title: "عدد", ratioToBase: "1", precision: 6, roundingMode: "half-up", taxpayerUnitCode: null },
          baseUnit: { unitId: "unit", code: "EA", title: "عدد", ratioToBase: "1", precision: 6, roundingMode: "half-up", taxpayerUnitCode: null },
        },
        warehouse: { warehouseId: "warehouse-1", zoneId: null, locationId: null },
        destination: null,
      },
    }],
    createdAt,
  });
  document = submitInventoryDocument(document, { occurredAt: "2026-09-08T08:01:00Z", actorUserId });
  document = approveInventoryDocument(document, { occurredAt: "2026-09-08T08:02:00Z", actorUserId });
  return confirmInventoryDocument(document, { occurredAt: "2026-09-08T08:03:00Z", actorUserId });
}

function receiptLedger(quantity = "10") {
  return rebuildInventoryStockLedger([createInventoryStockMovement({
    movementId: "receipt-movement",
    companyId,
    documentId: "receipt-1",
    lineId: "line-1",
    productId: "product-1",
    warehouse: { warehouseId: "warehouse-1" },
    businessDate: "2026-09-08",
    businessOrder: 1,
    recordedAt: "2026-09-08T08:03:00Z",
    quantityDelta: quantity,
  })]);
}

function rejects(action: () => unknown, code: InventoryDomainErrorCode): void {
  assert.throws(action, (error: unknown) => error instanceof InventoryDomainError && error.code === code);
}

test("reversal appends exact inverse fact and links original lifecycle to compensating document", () => {
  const original = confirmedDocument();
  const ledger = receiptLedger();
  const result = reverseInventoryStockEffects({
    document: original,
    action: {
      occurredAt: "2026-09-09T08:00:00Z",
      actorUserId,
      reason: "Reverse incorrect receipt",
      reversalDocumentId: "reversal-1",
    },
    businessDate: "2026-09-09",
    businessOrder: 2,
    movementIdentities: [{ originalMovementId: "receipt-movement", reversalMovementId: "reversal-movement" }],
    ledger,
  });
  assert.equal(result.document.status, "reversed");
  assert.equal(result.document.lifecycleHistory.at(-1)?.relatedDocumentId, "reversal-1");
  assert.equal(result.movements[0]?.documentId, "reversal-1");
  assert.equal(result.movements[0]?.quantityDelta, "-10");
  assert.equal(result.movements[0]?.reversalOfMovementId, "receipt-movement");
  assert.equal(result.movements[0]?.transferId, null);
  const key = createInventoryStockKey({ companyId, productId: "product-1", warehouse: { warehouseId: "warehouse-1" } });
  assert.equal(getInventoryStockBalance(result.ledger, key).quantity, "0");
  assert.equal(ledger.movements.length, 1);
});

test("reversing a consumed receipt is rejected by the default negative-stock policy", () => {
  const original = confirmedDocument();
  const ledger = rebuildInventoryStockLedger([
    ...receiptLedger().movements,
    createInventoryStockMovement({
      movementId: "later-issue",
      companyId,
      documentId: "issue-1",
      lineId: "line-1",
      productId: "product-1",
      warehouse: { warehouseId: "warehouse-1" },
      businessDate: "2026-09-09",
      businessOrder: 1,
      recordedAt: "2026-09-09T07:00:00Z",
      quantityDelta: "-4",
    }),
  ]);
  rejects(() => reverseInventoryStockEffects({
    document: original,
    action: {
      occurredAt: "2026-09-10T08:00:00Z",
      actorUserId,
      reason: "Reverse receipt",
      reversalDocumentId: "reversal-2",
    },
    businessDate: "2026-09-10",
    businessOrder: 3,
    movementIdentities: [{ originalMovementId: "receipt-movement", reversalMovementId: "reversal-movement-2" }],
    ledger,
  }), codes.negativeStock);
  assert.equal(original.status, "confirmed");
  assert.equal(ledger.movements.length, 2);
});

test("the same original movement cannot be compensated twice", () => {
  const original = confirmedDocument();
  const first = reverseInventoryStockEffects({
    document: original,
    action: {
      occurredAt: "2026-09-09T08:00:00Z",
      actorUserId,
      reason: "Reverse receipt",
      reversalDocumentId: "reversal-1",
    },
    businessDate: "2026-09-09",
    businessOrder: 2,
    movementIdentities: [{ originalMovementId: "receipt-movement", reversalMovementId: "reversal-movement" }],
    ledger: receiptLedger(),
  });
  rejects(() => reverseInventoryStockEffects({
    document: original,
    action: {
      occurredAt: "2026-09-10T08:00:00Z",
      actorUserId,
      reason: "Reverse again",
      reversalDocumentId: "reversal-2",
    },
    businessDate: "2026-09-10",
    businessOrder: 3,
    movementIdentities: [{ originalMovementId: "receipt-movement", reversalMovementId: "reversal-movement-2" }],
    ledger: first.ledger,
  }), codes.reversalReferenceInvalid);
});
