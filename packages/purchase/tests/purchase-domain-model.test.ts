import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
  createPurchaseDocument,
  rehydratePurchaseDocument,
} from "../src/index.ts";

const createdAt = "2026-09-14T08:00:00.000Z";
const scope = {
  companyId: "company-001",
  branchId: "branch-001",
  fiscalYearId: "fy-1405",
  fiscalPeriodId: "fp-1405-06",
  fiscalYearStartDate: "2026-03-21",
  fiscalYearEndDate: "2027-03-20",
  fiscalPeriodStartDate: "2026-08-23",
  fiscalPeriodEndDate: "2026-09-22",
  fiscalYearStatus: "open" as const,
  fiscalPeriodStatus: "open" as const,
  lockedThroughDate: "2026-09-01",
};
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
  itemId: "product-stock-001", itemType: "product" as const, code: "STK-001",
  displayName: "کالای انباری", stockTracking: true,
  taxTreatment: "taxable" as const, vatRateBasisPoints: 1000,
  taxpayerGoodsServiceId: "2720000014385",
};
const nonStockItemSnapshot = {
  itemId: "product-non-stock-001", itemType: "product" as const, code: "NST-001",
  displayName: "کالای غیرانباری", stockTracking: false,
  taxTreatment: "unspecified" as const, vatRateBasisPoints: null,
};
const serviceItemSnapshot = {
  itemId: "service-001", itemType: "service" as const, code: "SRV-001",
  displayName: "خدمت نمونه", stockTracking: false,
  taxTreatment: "exempt" as const, vatRateBasisPoints: null,
};

function baseInput(documentId: string) {
  return {
    scope,
    documentId,
    companyId: "company-001",
    supplierId: "party-supplier-001",
    supplierSnapshot,
    documentType: "supplier-invoice" as const,
    businessDate: "2026-09-14",
    createdAt,
  };
}
function createValidDocument() {
  return createPurchaseDocument({
    ...baseInput("purchase-doc-001"),
    documentNumber: "PINV-000001",
    lines: [
      { lineId: "line-001", position: 1, lineKind: "stock-product", itemId: "product-stock-001", itemSnapshot: stockItemSnapshot },
      { lineId: "line-002", position: 2, lineKind: "non-stock-product", itemId: "product-non-stock-001", itemSnapshot: nonStockItemSnapshot },
      { lineId: "line-003", position: 3, lineKind: "service", itemId: "service-001", itemSnapshot: serviceItemSnapshot },
    ],
  });
}
function assertDomainError(action: () => unknown, code: string, field: string): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof PurchaseDomainError);
    assert.equal(error.code, code);
    assert.equal(error.field, field);
    return true;
  });
}

test("creates a scoped persistence-neutral Purchase aggregate with historical snapshots", () => {
  const document = createValidDocument();
  assert.equal(document.documentId, "purchase-doc-001");
  assert.equal(document.scope.branchId, "branch-001");
  assert.equal(document.scope.fiscalYearId, "fy-1405");
  assert.equal(document.documentNumber, "PINV-000001");
  assert.equal(document.status, "draft");
  assert.equal(document.supplierSnapshot.displayName, "تأمین کننده نمونه");
  assert.equal(document.lines[0]?.itemSnapshot.taxpayerGoodsServiceId, "2720000014385");
  assert.ok(Object.isFrozen(document.scope));
});

test("rejects duplicate line identities and positions", () => {
  assertDomainError(() => createPurchaseDocument({ ...baseInput("purchase-doc-002"), lines: [
    { lineId: "same", position: 1, lineKind: "stock-product", itemId: "product-stock-001", itemSnapshot: stockItemSnapshot },
    { lineId: "same", position: 2, lineKind: "service", itemId: "service-001", itemSnapshot: serviceItemSnapshot },
  ] }), PURCHASE_DOMAIN_ERROR_CODES.duplicateLineId, "lines.lineId");
  assertDomainError(() => createPurchaseDocument({ ...baseInput("purchase-doc-003"), lines: [
    { lineId: "a", position: 1, lineKind: "stock-product", itemId: "product-stock-001", itemSnapshot: stockItemSnapshot },
    { lineId: "b", position: 1, lineKind: "service", itemId: "service-001", itemSnapshot: serviceItemSnapshot },
  ] }), PURCHASE_DOMAIN_ERROR_CODES.duplicateLinePosition, "lines.position");
});

test("enforces item classification and durable snapshot identity", () => {
  assertDomainError(() => createPurchaseDocument({ ...baseInput("purchase-doc-004"), lines: [
    { lineId: "a", position: 1, lineKind: "non-stock-product", itemId: "product-stock-001", itemSnapshot: stockItemSnapshot },
  ] }), PURCHASE_DOMAIN_ERROR_CODES.itemSnapshotMismatch, "lines.itemSnapshot.stockTracking");
  assertDomainError(() => createPurchaseDocument({ ...baseInput("purchase-doc-005"), lines: [
    { lineId: "a", position: 1, lineKind: "stock-product", itemId: "product-stock-001", itemSnapshot: { ...stockItemSnapshot, itemId: "other" } },
  ] }), PURCHASE_DOMAIN_ERROR_CODES.itemSnapshotMismatch, "lines.itemSnapshot");
});

test("rejects Company/Fiscal scope mismatches and blocked business dates", () => {
  assertDomainError(
    () => createPurchaseDocument({ ...baseInput("purchase-doc-006"), scope: { ...scope, companyId: "other-company" }, lines: [] }),
    PURCHASE_DOMAIN_ERROR_CODES.scopeMismatch,
    "scope.companyId",
  );
  assertDomainError(
    () => createPurchaseDocument({ ...baseInput("purchase-doc-007"), businessDate: "2026-09-01", lines: [] }),
    PURCHASE_DOMAIN_ERROR_CODES.fiscalDateLocked,
    "businessDate",
  );
});

test("preserves references and prevents self-reference", () => {
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

test("rehydration preserves scope/lifecycle and rejects invalid aggregate version", () => {
  const snapshot = createValidDocument();
  const rehydrated = rehydratePurchaseDocument(snapshot);
  assert.deepEqual(rehydrated.scope, snapshot.scope);
  assert.deepEqual(rehydrated.supplierSnapshot, snapshot.supplierSnapshot);
  assert.equal(rehydrated.status, "draft");
  assertDomainError(
    () => rehydratePurchaseDocument({ ...snapshot, version: 0 }),
    PURCHASE_DOMAIN_ERROR_CODES.versionInvalid,
    "version",
  );
});
