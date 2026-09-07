import assert from "node:assert/strict";
import test from "node:test";
import { createProduct, createProductMasterDataProfile, createProductUnitProfile } from "@argin/product";
import { createWarehouse, classifyWarehouse, createWarehouseZone, createWarehouseLocation } from "@argin/warehouse";
import type { ProductUnitProfile, QuantityRoundingMode } from "@argin/product";
import {
  createInventoryDocument, createInventoryDocumentLine, rehydrateInventoryDocument,
  createInventoryLineOperation, rehydrateInventoryLineOperation,
  createInventoryQuantitySnapshot, rehydrateInventoryQuantitySnapshot, normalizeInventoryQuantity,
  validateInventoryWarehouseReference, InventoryDomainError,
  INVENTORY_DOMAIN_ERROR_CODES as codes,
} from "../src/index.ts";
import type { InventoryDomainErrorCode, InventoryProductReference } from "../src/index.ts";

const at = "2026-09-07T00:00:00Z";
const companyId = "company-1";
const profile = (ratio = 12, precision = 6, mode: QuantityRoundingMode = "half-up"): ProductUnitProfile => createProductUnitProfile({
  baseUnit: { unitId: "unit", code: "EA", title: "عدد", precision, roundingMode: mode },
  alternateUnits: [{ unitId: "box", code: "BOX", title: "بسته", ratioToBase: ratio, precision: 6, roundingMode: "half-up" }],
});
const product = (): InventoryProductReference => ({
  ...createProduct({ productId: "product-1", companyId, code: "P1", title: "کالا", kind: "product", createdAt: at }),
  version: 3, units: profile(), masterData: createProductMasterDataProfile({ kind: "product", operational: { stockTracking: true } }),
});
const warehouse = classifyWarehouse({ warehouse: createWarehouse({ warehouseId: "warehouse-1", companyId, code: "W1", title: "انبار", createdAt: at }), kind: "general" });
const zone = createWarehouseZone({ zoneId: "zone-1", warehouse, code: "Z1", title: "ناحیه", createdAt: at });
const location = createWarehouseLocation({ locationId: "location-1", warehouse, zone, code: "L1", title: "قفسه", kind: "shelf", createdAt: at });
const reference = { warehouseId: warehouse.warehouseId, zoneId: zone.zoneId, locationId: location.locationId };
const resolved = { warehouse, zone, location };
const input = () => ({ companyId, productId: "product-1", product: product(), enteredQuantity: "2.5", unitId: "box", warehouse: reference, resolvedWarehouse: resolved });
const doc = { documentId: "doc-1", companyId, documentType: "receipt" as const, businessDate: "2026-09-07", createdAt: at };
function rejects(action: () => unknown, code?: InventoryDomainErrorCode): void {
  assert.throws(action, (error: unknown) => error instanceof InventoryDomainError && (code === undefined || error.code === code));
}

test("exact decimal canonicalization preserves values above the number safe-integer limit", () => {
  assert.equal(normalizeInventoryQuantity(" 0009007199254740993.1000 "), "9007199254740993.1");
  assert.equal(normalizeInventoryQuantity("-0.000"), "0");
  assert.equal(normalizeInventoryQuantity("-000.00100"), "-0.001");
  const result = createInventoryQuantitySnapshot({ enteredQuantity: "9007199254740993.1", unitId: "box", profile: profile(10) });
  assert.equal(result.baseQuantity, "90071992547409931");
});

test("rejects numeric input, exponent quantities, locale text and excessive precision/range", () => {
  for (const value of [0.1, NaN, Infinity, null, {}, "1e3", "1,000", "۱.۲", "1.", ".1", "+1", "1".repeat(37), "0.0000000000000000001", "0".repeat(129)]) {
    rejects(() => normalizeInventoryQuantity(value as never), codes.quantityInvalid);
  }
});

test("snapshots entered/base quantity, unit IDs and metadata without float multiplication", () => {
  const quantity = createInventoryQuantitySnapshot({ enteredQuantity: "0.1", unitId: "box", profile: profile(0.2) });
  assert.equal(quantity.enteredQuantity, "0.1");
  assert.equal(quantity.baseQuantity, "0.02");
  assert.equal(quantity.enteredUnit.ratioToBase, "0.2");
  assert.equal(quantity.baseUnit.ratioToBase, "1");
  assert.equal(quantity.enteredUnit.title, "بسته");
  assert.equal(quantity.baseUnit.unitId, "unit");
});

test("expands supported legacy exponential ratios and rejects precision loss instead of guessing", () => {
  assert.equal(createInventoryQuantitySnapshot({ enteredQuantity: "10", unitId: "box", profile: profile(1e-7) }).baseQuantity, "0.000001");
  for (const ratio of [Number.MAX_SAFE_INTEGER + 1, Number.MIN_VALUE, Infinity, NaN, 0, -1]) {
    const units = profile();
    const altered = { ...units, units: units.units.map(unit => unit.unitId === "box" ? { ...unit, ratioToBase: ratio } : unit) };
    rejects(() => createInventoryQuantitySnapshot({ enteredQuantity: "1", unitId: "box", profile: altered }));
  }
});

for (const [mode, positive, negative] of [["half-up", "2", "-2"], ["down", "1", "-1"], ["up", "2", "-2"]] as const) {
  test(`Phase 18 ${mode} rounding uses exact quotient/remainder for both signs`, () => {
    for (const [enteredQuantity, expected] of [["1", positive], ["-1", negative]]) {
      assert.equal(createInventoryQuantitySnapshot({ enteredQuantity: enteredQuantity!, unitId: "box", profile: profile(1.5, 0, mode) }).baseQuantity, expected);
    }
    assert.equal(createInventoryQuantitySnapshot({ enteredQuantity: "2", unitId: "box", profile: profile(1.5, 0, mode) }).baseQuantity, "3");
  });
}

test("rounds below/above half correctly without intermediate rounding", () => {
  assert.equal(createInventoryQuantitySnapshot({ enteredQuantity: "1", unitId: "box", profile: profile(1.49, 0) }).baseQuantity, "1");
  assert.equal(createInventoryQuantitySnapshot({ enteredQuantity: "1", unitId: "box", profile: profile(1.51, 0) }).baseQuantity, "2");
  assert.equal(createInventoryQuantitySnapshot({ enteredQuantity: "0.3", unitId: "box", profile: profile(0.333333, 6) }).baseQuantity, "0.1");
});

test("rejects entered precision above the selected unit and zero/rounded-zero stock", () => {
  rejects(() => createInventoryQuantitySnapshot({ enteredQuantity: "0.0000001", unitId: "box", profile: profile() }), codes.quantityPrecisionInvalid);
  for (const enteredQuantity of ["0", "-0", "0.0"]) rejects(() => createInventoryQuantitySnapshot({ enteredQuantity, unitId: "box", profile: profile() }), codes.quantityZero);
  rejects(() => createInventoryQuantitySnapshot({ enteredQuantity: "1", unitId: "box", profile: profile(0.1, 0, "down") }), codes.quantityZero);
  rejects(() => createInventoryQuantitySnapshot({ enteredQuantity: "9".repeat(36), unitId: "box", profile: profile(12) }), codes.quantityInvalid);
});

test("base-unit selection uses an identical historical unit snapshot", () => {
  const snapshot = createInventoryQuantitySnapshot({ enteredQuantity: "2.500", unitId: "unit", profile: profile() });
  assert.equal(snapshot.baseQuantity, "2.5");
  assert.deepEqual(snapshot.baseUnit, snapshot.enteredUnit);
  rejects(() => rehydrateInventoryQuantitySnapshot({ ...snapshot, enteredUnit: { ...snapshot.enteredUnit, roundingMode: "down" } }), codes.unitInvalid);
});

test("validates missing/duplicate units, base ratio, precision and rounding mode", () => {
  rejects(() => createInventoryQuantitySnapshot({ enteredQuantity: "1", unitId: "missing", profile: profile() }), codes.unitNotFound);
  const base = profile();
  const alterations = [
    { ...base, units: [] }, { ...base, baseUnitId: "missing" },
    { ...base, units: [base.units[0]!, base.units[0]!] },
    { ...base, units: base.units.map(unit => ({ ...unit, code: "SAME" })) },
    { ...base, units: base.units.map(unit => ({ ...unit, precision: 7 })) },
    { ...base, units: base.units.map(unit => ({ ...unit, roundingMode: "invalid" as never })) },
    { ...base, units: base.units.map(unit => ({ ...unit, ratioToBase: 2 })) },
    { ...base, units: Array(1) },
  ];
  for (const altered of alterations) rejects(() => createInventoryQuantitySnapshot({ enteredQuantity: "1", unitId: "unit", profile: altered }));
});

test("history survives later unit edits, removal and serialized round-trip; drift is rejected", () => {
  const units = profile();
  const snapshot = createInventoryQuantitySnapshot({ enteredQuantity: "2.5", unitId: "box", profile: units });
  const replacement = profile(24);
  assert.equal(createInventoryQuantitySnapshot({ enteredQuantity: "2.5", unitId: "box", profile: replacement }).baseQuantity, "60");
  assert.equal(rehydrateInventoryQuantitySnapshot(JSON.parse(JSON.stringify(snapshot))).baseQuantity, "30");
  rejects(() => rehydrateInventoryQuantitySnapshot({ ...snapshot, baseQuantity: "31" }), codes.quantitySnapshotMismatch);
  rejects(() => rehydrateInventoryQuantitySnapshot({ ...snapshot, enteredUnit: { ...snapshot.enteredUnit, ratioToBase: "24" } }), codes.quantitySnapshotMismatch);
  assert.ok(Object.isFrozen(snapshot.enteredUnit));
  assert.ok(Object.isFrozen(snapshot.baseUnit));
});

test("creates a Company-scoped operation from public Product/Warehouse factories", () => {
  const operation = createInventoryLineOperation(input());
  assert.equal(operation.productVersion, 3);
  assert.equal(operation.quantity.baseQuantity, "30");
  assert.deepEqual(operation.warehouse, reference);
  assert.equal(operation.destination, null);
  assert.deepEqual(Object.keys(operation.warehouse).sort(), ["locationId", "warehouseId", "zoneId"]);
});

test("rejects service, inactive, non-stock and unsupported tracked products", () => {
  const base = product();
  for (const altered of [
    { ...base, kind: "service" as const }, { ...base, status: "inactive" as const }, { ...base, units: null }, { ...base, deletedAt: at },
    ...[{ stockTracking: false }, { serialTracking: true }, { lotTracking: true }, { shelfLifeDays: 30 }].map(change => ({ ...base, masterData: { ...base.masterData, operational: { ...base.masterData.operational, ...change } } })),
  ]) rejects(() => createInventoryLineOperation({ ...input(), product: altered }), codes.productIneligible);
});

test("rejects missing, wrong-Company and mismatched Product references", () => {
  for (const altered of [null, { ...product(), companyId: "other" }, { ...product(), productId: "other" }]) {
    rejects(() => createInventoryLineOperation({ ...input(), product: altered }), codes.productReferenceMismatch);
  }
  rejects(() => createInventoryLineOperation({ ...input(), product: { ...product(), version: 0 } }), codes.versionInvalid);
});

test("supports warehouse-only, zone and full physical references", () => {
  assert.deepEqual(validateInventoryWarehouseReference(companyId, { warehouseId: warehouse.warehouseId }, { warehouse }), { warehouseId: warehouse.warehouseId });
  assert.deepEqual(validateInventoryWarehouseReference(companyId, { warehouseId: warehouse.warehouseId, zoneId: zone.zoneId }, { warehouse, zone }), { warehouseId: warehouse.warehouseId, zoneId: zone.zoneId });
  assert.deepEqual(validateInventoryWarehouseReference(companyId, reference, resolved), reference);
  rejects(() => validateInventoryWarehouseReference(companyId, { warehouseId: warehouse.warehouseId, locationId: location.locationId }, resolved), codes.referenceInvalid);
});

test("rejects missing and mismatched Warehouse/Zone/Location identity and ancestry", () => {
  const cases = [
    { ...resolved, warehouse: null }, { ...resolved, zone: null }, { ...resolved, location: null },
    { ...resolved, warehouse: { ...warehouse, companyId: "other" } },
    { ...resolved, warehouse: { ...warehouse, warehouseId: "other" } },
    { ...resolved, zone: { ...zone, companyId: "other" } },
    { ...resolved, zone: { ...zone, warehouseId: "other" } },
    { ...resolved, zone: { ...zone, zoneId: "other" } },
    { ...resolved, location: { ...location, companyId: "other" } },
    { ...resolved, location: { ...location, warehouseId: "other" } },
    { ...resolved, location: { ...location, zoneId: "other" } },
    { ...resolved, location: { ...location, locationId: "other" } },
  ];
  for (const state of cases) rejects(() => validateInventoryWarehouseReference(companyId, reference, state), codes.referenceMismatch);
  rejects(() => validateInventoryWarehouseReference(companyId, { warehouseId: warehouse.warehouseId }, resolved), codes.referenceMismatch);
});

test("rejects inactive/archived/tombstoned physical masters for new operations", () => {
  for (const key of ["warehouse", "zone", "location"] as const) {
    rejects(() => validateInventoryWarehouseReference(companyId, reference, { ...resolved, [key]: { ...resolved[key], status: "inactive" } }), codes.referenceIneligible);
    rejects(() => validateInventoryWarehouseReference(companyId, reference, { ...resolved, [key]: { ...resolved[key], deletedAt: at } }), codes.referenceIneligible);
  }
  rejects(() => validateInventoryWarehouseReference(companyId, reference, { ...resolved, warehouse: { ...warehouse, status: "archived" } }), codes.referenceIneligible);
});

test("history uses stored references even when current masters become inactive", () => {
  const operation = createInventoryLineOperation(input());
  const restored = rehydrateInventoryLineOperation(JSON.parse(JSON.stringify(operation)));
  assert.deepEqual(restored, operation);
  assert.ok(Object.isFrozen(restored.warehouse));
  assert.ok(Object.isFrozen(restored.quantity.enteredUnit));
  rejects(() => createInventoryLineOperation({ ...input(), resolvedWarehouse: { ...resolved, warehouse: { ...warehouse, status: "inactive" } } }), codes.referenceIneligible);
});

test("transfer endpoints require distinct durable positions in the same Company", () => {
  const destination = { warehouseId: warehouse.warehouseId, zoneId: zone.zoneId };
  const operation = createInventoryLineOperation({ ...input(), destination, resolvedDestination: { warehouse, zone } });
  assert.deepEqual(operation.destination, destination);
  rejects(() => createInventoryLineOperation({ ...input(), destination: reference, resolvedDestination: resolved }), codes.operationMismatch);
  rejects(() => createInventoryLineOperation({ ...input(), destination, resolvedDestination: { warehouse: { ...warehouse, companyId: "other" }, zone } }), codes.referenceMismatch);
  rejects(() => createInventoryLineOperation({ ...input(), destination }), codes.referenceMismatch);
});

test("document integration preserves snapshots and rejects product/company/type mismatches", () => {
  const operation = createInventoryLineOperation(input());
  const line = { lineId: "line-1", position: 1, productId: "product-1", operation };
  const document = createInventoryDocument({ ...doc, lines: [line] });
  assert.deepEqual(rehydrateInventoryDocument(JSON.parse(JSON.stringify(document))), document);
  assert.equal(document.lines[0]?.operation?.quantity.baseQuantity, "30");
  rejects(() => createInventoryDocument({ ...doc, lines: [{ ...line, productId: "other" }] }), codes.operationMismatch);
  rejects(() => createInventoryDocument({ ...doc, companyId: "other", lines: [line] }), codes.operationMismatch);
  rejects(() => createInventoryDocument({ ...doc, documentType: "transfer", lines: [line] }), codes.operationMismatch);
  const negative = createInventoryLineOperation({ ...input(), enteredQuantity: "-2.5" });
  rejects(() => createInventoryDocument({ ...doc, lines: [{ ...line, operation: negative }] }), codes.operationMismatch);
  assert.equal(createInventoryDocument({ ...doc, documentType: "adjustment", lines: [{ ...line, operation: negative }] }).lines[0]?.operation?.quantity.baseQuantity, "-30");
});

test("malformed physical/quantity snapshots cannot bypass rehydration checks", () => {
  const operation = createInventoryLineOperation(input());
  rejects(() => rehydrateInventoryLineOperation({ ...operation, warehouse: null as never }), codes.referenceInvalid);
  rejects(() => rehydrateInventoryLineOperation({ ...operation, productVersion: NaN }), codes.versionInvalid);
  rejects(() => rehydrateInventoryLineOperation({ ...operation, quantity: { ...operation.quantity, baseQuantity: "999" } }), codes.quantitySnapshotMismatch);
  rejects(() => createInventoryDocumentLine({ lineId: "l", position: 1, productId: "product-1", operation: { ...operation, quantity: null as never } }), codes.quantityInvalid);
});

test("transfer snapshot attaches only to transfer documents; destination is frozen", () => {
  const destinationWarehouse = { ...warehouse, warehouseId: "warehouse-2" };
  const operation = createInventoryLineOperation({ ...input(), destination: { warehouseId: "warehouse-2" }, resolvedDestination: { warehouse: destinationWarehouse } });
  const lines = [{ lineId: "line-1", productId: "product-1", position: 1, operation }];
  const document = createInventoryDocument({ ...doc, documentType: "transfer", lines });
  assert.equal(document.lines[0]?.operation?.destination?.warehouseId, "warehouse-2");
  assert.ok(Object.isFrozen(document.lines[0]?.operation?.destination));
  rejects(() => createInventoryDocument({ ...doc, lines }), codes.operationMismatch);
  rejects(() => createInventoryDocumentLine({ ...lines[0]!, productId: "other" }), codes.operationMismatch);
});

test("plain mutable unit and reference inputs are copied before becoming historical snapshots", () => {
  const original = input();
  const mutableProfile = { baseUnitId: "unit", units: profile().units.map(unit => ({ ...unit })) };
  const mutableRef = { ...reference };
  const operation = createInventoryLineOperation({ ...original, product: { ...product(), units: mutableProfile }, warehouse: mutableRef });
  mutableProfile.units[1]!.ratioToBase = 99;
  mutableProfile.units[1]!.title = "changed";
  mutableProfile.units.length = 0;
  mutableRef.locationId = "different-location";
  assert.equal(operation.quantity.baseQuantity, "30");
  assert.equal(operation.quantity.enteredUnit.ratioToBase, "12");
  assert.equal(operation.quantity.enteredUnit.title, "بسته");
  assert.equal(operation.warehouse.locationId, "location-1");
  assert.deepEqual(rehydrateInventoryLineOperation(JSON.parse(JSON.stringify(operation))), operation);
});
