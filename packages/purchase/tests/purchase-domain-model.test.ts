import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
  createPurchaseDocument,
  rehydratePurchaseDocument,
} from "../src/index.ts";

const createdAt = "2026-09-14T08:00:00.000Z";

const supplierSnapshot = {
  companyId: "company-001",
  supplierId: "party-supplier-001",
  code: "SUP-001",
  displayName: "تأمین کننده نمونه",
  classification: "legal-entity" as const,
  nationalCode: null,
  nationalId: "10101234567",
  economicNumber: "411111111111",
  taxFileNumber: "TX-001",
};

const stockItemSnapshot = {
  itemId: "product-stock-001",
  itemType: "product" as const,
  code: "STK-001",
  displayName: "کالای انباری",
  stockTracking: true,
  taxTreatment: "taxable" as const,
  vatRateBasisPoints: 1000,
  taxpayerGoodsServiceId: "2720000014385",
};

const nonStockItemSnapshot = {
  itemId: "product-non-stock-001",
  itemType: "product" as const,
  code: "NST-001",
  displayName: "کالای غیرانباری",
  stockTracking: false,
  taxTreatment: "unspecified" as const,
  vatRateBasisPoints: null,
};

const serviceItemSnapshot = {
  itemId: "service-001",
  itemType: "service" as const,
  code: "SRV-001",
  displayName: "خدمت نمونه",
  stockTracking: false,
  taxTreatment: "exempt" as const,
  vatRateBasisPoints: null,
};

function createValidDocument() {
  return createPurchaseDocument({
    documentId: "purchase-doc-001",
    companyId: "company-001",
    supplierId: "party-supplier-001",
    supplierSnapshot,
    businessDate: "2026-09-14",
    createdAt,
    lines: [
      { lineId: "line-001", position: 1, lineKind: "stock-product", itemId: "product-stock-001", itemSnapshot: stockItemSnapshot },
      { lineId: "line-002", position: 2, lineKind: "non-stock-product", itemId: "product-non-stock-001", itemSnapshot: nonStockItemSnapshot },
      { lineId: "line-003", position: 3, lineKind: "service", itemId: "service-001", itemSnapshot: serviceItemSnapshot },
    ],
  });
}

function baseInput(documentId: string) {
  return {
    documentId,
    companyId: "company-001",
    supplierId: "party-supplier-001",
    supplierSnapshot,
    businessDate: "2026-09-14",
    createdAt,
  };
}

function assertDomainError(action: () => unknown, code: string, field: string): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof PurchaseDomainError);
    assert.equal(error.code, code);
    assert.equal(error.field, field);
    return true;
  });
}

test("creates a persistence-neutral Purchase aggregate with immutable historical snapshots", () => {
  const document = createValidDocument();
  assert.equal(document.documentId, "purchase-doc-001");
  assert.equal(document.supplierSnapshot.displayName, "تأمین کننده نمونه");
  assert.equal(document.lines[0]?.itemSnapshot.taxpayerGoodsServiceId, "2720000014385");
  assert.equal(document.version, 1);
  assert.ok(Object.isFrozen(document));
  assert.ok(Object.isFrozen(document.supplierSnapshot));
  assert.ok(document.lines.every((line) => Object.isFrozen(line.itemSnapshot)));
});

test("rejects duplicate durable line identities and positions", () => {
  assertDomainError(
    () => createPurchaseDocument({ ...baseInput("purchase-doc-002"), lines: [
      { lineId: "same-line", position: 1, lineKind: "stock-product", itemId: "product-stock-001", itemSnapshot: stockItemSnapshot },
      { lineId: "same-line", position: 2, lineKind: "service", itemId: "service-001", itemSnapshot: serviceItemSnapshot },
    ] }),
    PURCHASE_DOMAIN_ERROR_CODES.duplicateLineId,
    "lines.lineId",
  );
  assertDomainError(
    () => createPurchaseDocument({ ...baseInput("purchase-doc-003"), lines: [
      { lineId: "line-001", position: 1, lineKind: "stock-product", itemId: "product-stock-001", itemSnapshot: stockItemSnapshot },
      { lineId: "line-002", position: 1, lineKind: "service", itemId: "service-001", itemSnapshot: serviceItemSnapshot },
    ] }),
    PURCHASE_DOMAIN_ERROR_CODES.duplicateLinePosition,
    "lines.position",
  );
});

test("enforces Product, Service and stock/non-stock snapshot classification invariants", () => {
  assertDomainError(
    () => createPurchaseDocument({ ...baseInput("purchase-doc-004"), lines: [
      { lineId: "line-001", position: 1, lineKind: "service", itemId: "product-stock-001", itemType: "product", itemSnapshot: stockItemSnapshot },
    ] }),
    PURCHASE_DOMAIN_ERROR_CODES.lineClassificationInvalid,
    "lines.itemType",
  );
  assertDomainError(
    () => createPurchaseDocument({ ...baseInput("purchase-doc-005"), lines: [
      { lineId: "line-001", position: 1, lineKind: "non-stock-product", itemId: "product-stock-001", itemSnapshot: stockItemSnapshot },
    ] }),
    PURCHASE_DOMAIN_ERROR_CODES.itemSnapshotMismatch,
    "lines.itemSnapshot.stockTracking",
  );
});

test("rejects supplier and item snapshots that do not match durable aggregate identities", () => {
  assertDomainError(
    () => createPurchaseDocument({ ...baseInput("purchase-doc-006"), supplierSnapshot: { ...supplierSnapshot, supplierId: "other-party" }, lines: [] }),
    PURCHASE_DOMAIN_ERROR_CODES.supplierSnapshotMismatch,
    "supplierSnapshot",
  );
  assertDomainError(
    () => createPurchaseDocument({ ...baseInput("purchase-doc-007"), lines: [
      { lineId: "line-001", position: 1, lineKind: "stock-product", itemId: "product-stock-001", itemSnapshot: { ...stockItemSnapshot, itemId: "other-product" } },
    ] }),
    PURCHASE_DOMAIN_ERROR_CODES.itemSnapshotMismatch,
    "lines.itemSnapshot",
  );
});

test("normalizes source and correction references while preventing self-reference", () => {
  const document = createPurchaseDocument({
    ...baseInput("purchase-doc-008"),
    sourceReference: { sourceSystem: "legacy-erp", sourceDocumentId: "legacy-55", sourceLineId: null },
    correctionReference: { documentId: "purchase-doc-original", reason: "supplier correction" },
    lines: [],
  });
  assert.equal(document.sourceReference?.sourceDocumentId, "legacy-55");
  assert.equal(document.correctionReference?.documentId, "purchase-doc-original");
  assertDomainError(
    () => createPurchaseDocument({ ...baseInput("purchase-doc-009"), correctionReference: { documentId: "purchase-doc-009", reason: "self" }, lines: [] }),
    PURCHASE_DOMAIN_ERROR_CODES.selfReference,
    "correctionReference.documentId",
  );
});

test("rehydration preserves historical snapshots and rejects invalid chronology", () => {
  const snapshot = createValidDocument();
  const rehydrated = rehydratePurchaseDocument(snapshot);
  assert.deepEqual(rehydrated.supplierSnapshot, snapshot.supplierSnapshot);
  assert.deepEqual(rehydrated.lines[0]?.itemSnapshot, snapshot.lines[0]?.itemSnapshot);
  assertDomainError(
    () => rehydratePurchaseDocument({ ...snapshot, version: 0 }),
    PURCHASE_DOMAIN_ERROR_CODES.versionInvalid,
    "version",
  );
  assertDomainError(
    () => rehydratePurchaseDocument({ ...snapshot, updatedAt: "2026-09-14T07:59:59.000Z" }),
    PURCHASE_DOMAIN_ERROR_CODES.timestampOrderInvalid,
    "updatedAt",
  );
});
