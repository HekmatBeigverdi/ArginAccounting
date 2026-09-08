import assert from "node:assert/strict";
import test from "node:test";
import type { WarehouseOperationalReference } from "@argin/warehouse";
import {
  INVENTORY_DOMAIN_ERROR_CODES as codes,
  InventoryDomainError,
  addInventoryStockQuantities,
  appendInventoryStockMovement,
  compareInventoryStockMovements,
  createInventoryStockKey,
  createInventoryStockMovement,
  getInventoryStockBalance,
  rebuildInventoryStockLedger,
  rehydrateInventoryStockMovement,
  serializeInventoryStockKey,
} from "../src/index.ts";
import type { InventoryDomainErrorCode, InventoryStockMovementSnapshot } from "../src/index.ts";

const companyId = "company-1";
const warehouse: WarehouseOperationalReference = { warehouseId: "warehouse-1", zoneId: null, locationId: null };
const zone: WarehouseOperationalReference = { warehouseId: "warehouse-1", zoneId: "zone-1", locationId: null };
const location: WarehouseOperationalReference = { warehouseId: "warehouse-1", zoneId: "zone-1", locationId: "location-1" };

function rejects(action: () => unknown, code: InventoryDomainErrorCode): void {
  assert.throws(action, (error: unknown) => error instanceof InventoryDomainError && error.code === code);
}

function movement(overrides: Partial<{
  movementId: string;
  documentId: string;
  lineId: string;
  productId: string;
  warehouse: WarehouseOperationalReference;
  businessDate: string;
  businessOrder: number;
  recordedAt: string;
  quantityDelta: string;
}> = {}): InventoryStockMovementSnapshot {
  return createInventoryStockMovement({
    movementId: overrides.movementId ?? "movement-1",
    companyId,
    documentId: overrides.documentId ?? "doc-1",
    lineId: overrides.lineId ?? "line-1",
    productId: overrides.productId ?? "product-1",
    warehouse: overrides.warehouse ?? warehouse,
    businessDate: overrides.businessDate ?? "2026-09-08",
    businessOrder: overrides.businessOrder ?? 1,
    recordedAt: overrides.recordedAt ?? "2026-09-08T08:00:00Z",
    quantityDelta: overrides.quantityDelta ?? "10",
  });
}

test("stock key uses durable company/product/physical identities and preserves hierarchy", () => {
  const key = createInventoryStockKey({ companyId, productId: "product-1", warehouse: location });
  assert.deepEqual(key, {
    companyId,
    productId: "product-1",
    warehouseId: "warehouse-1",
    zoneId: "zone-1",
    locationId: "location-1",
  });
  assert.equal(Object.isFrozen(key), true);
  assert.equal(serializeInventoryStockKey(key), '["company-1","product-1","warehouse-1","zone-1","location-1"]');
});

test("stock key keeps warehouse, zone and location balances distinct", () => {
  const warehouseKey = createInventoryStockKey({ companyId, productId: "product-1", warehouse });
  const zoneKey = createInventoryStockKey({ companyId, productId: "product-1", warehouse: zone });
  const locationKey = createInventoryStockKey({ companyId, productId: "product-1", warehouse: location });
  assert.notEqual(serializeInventoryStockKey(warehouseKey), serializeInventoryStockKey(zoneKey));
  assert.notEqual(serializeInventoryStockKey(zoneKey), serializeInventoryStockKey(locationKey));
});

test("movement facts are canonical immutable base-unit deltas", () => {
  const fact = movement({ movementId: " move-1 ", quantityDelta: "0010.5000", recordedAt: "2026-09-08T08:00:00.1Z" });
  assert.equal(fact.movementId, "move-1");
  assert.equal(fact.quantityDelta, "10.5");
  assert.equal(fact.businessOrder, 1);
  assert.equal(fact.recordedAt, "2026-09-08T08:00:00.100Z");
  assert.equal(Object.isFrozen(fact), true);
  assert.equal(Object.isFrozen(fact.stockKey), true);
  assert.deepEqual(rehydrateInventoryStockMovement(JSON.parse(JSON.stringify(fact))), fact);
});

test("movement rejects zero quantity, malformed time and invalid business order", () => {
  rejects(() => movement({ quantityDelta: "0.000" }), codes.quantityZero);
  rejects(() => movement({ businessDate: "2026-02-29" }), codes.businessDateInvalid);
  rejects(() => movement({ recordedAt: "2026-09-08T11:30:00+03:30" }), codes.timestampInvalid);
  for (const businessOrder of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    rejects(() => movement({ businessOrder }), codes.stockOrderInvalid);
  }
});

test("exact ledger arithmetic never uses JavaScript floating point", () => {
  assert.equal(addInventoryStockQuantities("0.1", "0.2"), "0.3");
  assert.equal(addInventoryStockQuantities("9007199254740993.1", "0.2"), "9007199254740993.3");
  assert.equal(addInventoryStockQuantities("10.000000000000000001", "-0.000000000000000001"), "10");
});

test("rebuild derives balance only from append-only movement facts", () => {
  const ledger = rebuildInventoryStockLedger([
    movement({ movementId: "m-in", documentId: "doc-1", businessOrder: 1, quantityDelta: "10" }),
    movement({ movementId: "m-out", documentId: "doc-2", businessOrder: 2, quantityDelta: "-3" }),
  ]);
  const key = createInventoryStockKey({ companyId, productId: "product-1", warehouse });
  const balance = getInventoryStockBalance(ledger, key);
  assert.equal(balance.quantity, "7");
  assert.equal(balance.movementCount, 2);
  assert.equal(balance.lastMovementId, "m-out");
  assert.equal(Object.isFrozen(ledger), true);
  assert.equal(Object.isFrozen(ledger.movements), true);
  assert.equal(Object.isFrozen(ledger.balances), true);
});

test("input order cannot change deterministic business-date ledger order", () => {
  const later = movement({ movementId: "m-later", documentId: "doc-z", businessDate: "2026-09-09", businessOrder: 1, quantityDelta: "-2" });
  const earlier = movement({ movementId: "m-earlier", documentId: "doc-a", businessDate: "2026-09-08", businessOrder: 99, quantityDelta: "5" });
  const first = rebuildInventoryStockLedger([later, earlier]);
  const second = rebuildInventoryStockLedger([earlier, later]);
  assert.deepEqual(first, second);
  assert.deepEqual(first.movements.map(item => item.movementId), ["m-earlier", "m-later"]);
});

test("same-date ordering uses businessOrder before durable tie breakers", () => {
  const items = [
    movement({ movementId: "m-3", documentId: "doc-a", businessOrder: 2, quantityDelta: "1" }),
    movement({ movementId: "m-2", documentId: "doc-b", businessOrder: 1, quantityDelta: "1" }),
    movement({ movementId: "m-1", documentId: "doc-a", businessOrder: 1, quantityDelta: "1" }),
  ];
  const sorted = [...items].sort(compareInventoryStockMovements);
  assert.deepEqual(sorted.map(item => item.movementId), ["m-1", "m-2", "m-3"]);
});

test("default policy rejects current negative stock", () => {
  rejects(() => rebuildInventoryStockLedger([
    movement({ movementId: "m-out", documentId: "doc-1", quantityDelta: "-1" }),
  ]), codes.negativeStock);
});

test("same-day business order participates in negative-stock validation", () => {
  const receiptAfterIssue = [
    movement({ movementId: "receipt", documentId: "receipt", businessOrder: 2, quantityDelta: "10" }),
    movement({ movementId: "issue", documentId: "issue", businessOrder: 1, quantityDelta: "-5" }),
  ];
  rejects(() => rebuildInventoryStockLedger(receiptAfterIssue), codes.negativeStock);
  assert.equal(getInventoryStockBalance(rebuildInventoryStockLedger(receiptAfterIssue, { allowNegativeStock: true }), receiptAfterIssue[0]!.stockKey).quantity, "5");
});

test("default policy rejects a backdated movement that makes historical stock negative", () => {
  const receipt = movement({
    movementId: "receipt",
    documentId: "doc-b",
    businessDate: "2026-09-10",
    businessOrder: 1,
    quantityDelta: "10",
  });
  const issue = movement({
    movementId: "issue",
    documentId: "doc-c",
    businessDate: "2026-09-11",
    businessOrder: 1,
    quantityDelta: "-5",
  });
  const ledger = rebuildInventoryStockLedger([receipt, issue]);
  const backdatedIssue = movement({
    movementId: "backdated",
    documentId: "doc-a",
    businessDate: "2026-09-09",
    businessOrder: 1,
    quantityDelta: "-1",
  });
  rejects(() => appendInventoryStockMovement(ledger, backdatedIssue), codes.negativeStock);
  assert.equal(ledger.movements.length, 2);
  assert.equal(getInventoryStockBalance(ledger, receipt.stockKey).quantity, "5");
});

test("explicit policy can allow negative stock without changing canonical chronology", () => {
  const ledger = rebuildInventoryStockLedger([
    movement({ movementId: "m-out", documentId: "doc-a", businessOrder: 1, quantityDelta: "-2" }),
    movement({ movementId: "m-in", documentId: "doc-b", businessOrder: 2, quantityDelta: "5" }),
  ], { allowNegativeStock: true });
  assert.equal(getInventoryStockBalance(ledger, ledger.movements[0]!.stockKey).quantity, "3");
});

test("balances are isolated by stock key", () => {
  const ledger = rebuildInventoryStockLedger([
    movement({ movementId: "m-w", documentId: "doc-w", businessOrder: 1, quantityDelta: "10", warehouse }),
    movement({ movementId: "m-z", documentId: "doc-z", businessOrder: 2, quantityDelta: "4", warehouse: zone }),
    movement({ movementId: "m-l", documentId: "doc-l", businessOrder: 3, quantityDelta: "2", warehouse: location }),
    movement({ movementId: "m-p", documentId: "doc-p", businessOrder: 4, quantityDelta: "7", productId: "product-2" }),
  ]);
  assert.equal(ledger.balances.length, 4);
  assert.equal(getInventoryStockBalance(ledger, createInventoryStockKey({ companyId, productId: "product-1", warehouse })).quantity, "10");
  assert.equal(getInventoryStockBalance(ledger, createInventoryStockKey({ companyId, productId: "product-1", warehouse: zone })).quantity, "4");
  assert.equal(getInventoryStockBalance(ledger, createInventoryStockKey({ companyId, productId: "product-1", warehouse: location })).quantity, "2");
  assert.equal(getInventoryStockBalance(ledger, createInventoryStockKey({ companyId, productId: "product-2", warehouse })).quantity, "7");
});

test("missing balance is a derived zero projection, not a stored mutable fact", () => {
  const ledger = rebuildInventoryStockLedger([]);
  const key = createInventoryStockKey({ companyId, productId: "product-1", warehouse });
  const balance = getInventoryStockBalance(ledger, key);
  assert.deepEqual(balance, { stockKey: key, quantity: "0", movementCount: 0, lastMovementId: null });
  assert.equal(Object.isFrozen(balance), true);
});

test("duplicate movement identity and duplicate source fact are rejected", () => {
  const first = movement({ movementId: "m-1", documentId: "doc-1", lineId: "line-1", businessOrder: 1, quantityDelta: "2" });
  rejects(() => rebuildInventoryStockLedger([
    first,
    movement({ movementId: "m-1", documentId: "doc-2", lineId: "line-2", businessOrder: 2, quantityDelta: "1" }),
  ]), codes.duplicateMovementId);
  rejects(() => rebuildInventoryStockLedger([
    first,
    movement({ movementId: "m-2", documentId: "doc-1", lineId: "line-1", businessOrder: 2, quantityDelta: "1" }),
  ]), codes.duplicateMovementSource);
});

test("same document line may produce a distinct fact for a different stock key", () => {
  const ledger = rebuildInventoryStockLedger([
    movement({ movementId: "m-source", documentId: "transfer-1", lineId: "line-1", businessOrder: 1, warehouse, quantityDelta: "2" }),
    movement({ movementId: "m-destination", documentId: "transfer-1", lineId: "line-1", businessOrder: 1, warehouse: zone, quantityDelta: "2" }),
  ]);
  assert.equal(ledger.movements.length, 2);
});

test("rehydration detects tampered company and stock-key hierarchy", () => {
  const fact = movement();
  rejects(() => rehydrateInventoryStockMovement({ ...fact, companyId: "other-company" }), codes.stockKeyInvalid);
  rejects(() => rehydrateInventoryStockMovement({
    ...fact,
    stockKey: { ...fact.stockKey, locationId: "location-without-zone", zoneId: null },
  }), codes.referenceInvalid);
});
