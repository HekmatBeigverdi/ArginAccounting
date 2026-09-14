import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
  createPurchaseDocument,
  rehydratePurchaseDocument,
} from "../src/index.ts";

const createdAt = "2026-09-14T08:00:00.000Z";

function createValidDocument() {
  return createPurchaseDocument({
    documentId: "purchase-doc-001",
    companyId: "company-001",
    supplierId: "party-supplier-001",
    businessDate: "2026-09-14",
    createdAt,
    lines: [
      {
        lineId: "line-001",
        position: 1,
        lineKind: "stock-product",
        itemId: "product-stock-001",
      },
      {
        lineId: "line-002",
        position: 2,
        lineKind: "non-stock-product",
        itemId: "product-non-stock-001",
      },
      {
        lineId: "line-003",
        position: 3,
        lineKind: "service",
        itemId: "service-001",
      },
    ],
  });
}

function assertDomainError(
  action: () => unknown,
  code: string,
  field: string,
): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof PurchaseDomainError);
    assert.equal(error.code, code);
    assert.equal(error.field, field);
    return true;
  });
}

test("creates a persistence-neutral Purchase aggregate with durable header and line identities", () => {
  const document = createValidDocument();

  assert.equal(document.documentId, "purchase-doc-001");
  assert.equal(document.companyId, "company-001");
  assert.equal(document.supplierId, "party-supplier-001");
  assert.equal(document.version, 1);
  assert.equal(document.businessDate, "2026-09-14");
  assert.equal(document.createdAt, createdAt);
  assert.equal(document.updatedAt, createdAt);
  assert.deepEqual(
    document.lines.map((line) => [line.lineId, line.position, line.lineKind, line.itemId]),
    [
      ["line-001", 1, "stock-product", "product-stock-001"],
      ["line-002", 2, "non-stock-product", "product-non-stock-001"],
      ["line-003", 3, "service", "service-001"],
    ],
  );
  assert.ok(Object.isFrozen(document));
  assert.ok(Object.isFrozen(document.lines));
  assert.ok(document.lines.every(Object.isFrozen));
});

test("rejects duplicate durable line identities and positions", () => {
  assertDomainError(
    () => createPurchaseDocument({
      documentId: "purchase-doc-002",
      companyId: "company-001",
      supplierId: "party-supplier-001",
      businessDate: "2026-09-14",
      createdAt,
      lines: [
        { lineId: "same-line", position: 1, lineKind: "stock-product", itemId: "product-001" },
        { lineId: "same-line", position: 2, lineKind: "service", itemId: "service-001" },
      ],
    }),
    PURCHASE_DOMAIN_ERROR_CODES.duplicateLineId,
    "lines.lineId",
  );

  assertDomainError(
    () => createPurchaseDocument({
      documentId: "purchase-doc-003",
      companyId: "company-001",
      supplierId: "party-supplier-001",
      businessDate: "2026-09-14",
      createdAt,
      lines: [
        { lineId: "line-001", position: 1, lineKind: "stock-product", itemId: "product-001" },
        { lineId: "line-002", position: 1, lineKind: "service", itemId: "service-001" },
      ],
    }),
    PURCHASE_DOMAIN_ERROR_CODES.duplicateLinePosition,
    "lines.position",
  );
});

test("enforces Product, Service and stock/non-stock line classification invariants", () => {
  assertDomainError(
    () => createPurchaseDocument({
      documentId: "purchase-doc-004",
      companyId: "company-001",
      supplierId: "party-supplier-001",
      businessDate: "2026-09-14",
      createdAt,
      lines: [
        { lineId: "line-001", position: 1, lineKind: "service", itemId: "product-001", itemType: "product" },
      ],
    }),
    PURCHASE_DOMAIN_ERROR_CODES.lineClassificationInvalid,
    "lines.itemType",
  );

  assertDomainError(
    () => createPurchaseDocument({
      documentId: "purchase-doc-005",
      companyId: "company-001",
      supplierId: "party-supplier-001",
      businessDate: "2026-09-14",
      createdAt,
      lines: [
        { lineId: "line-001", position: 1, lineKind: "stock-product", itemId: "service-001", itemType: "service" },
      ],
    }),
    PURCHASE_DOMAIN_ERROR_CODES.lineClassificationInvalid,
    "lines.itemType",
  );
});

test("normalizes source and correction references while preventing self-reference", () => {
  const document = createPurchaseDocument({
    documentId: "purchase-doc-006",
    companyId: "company-001",
    supplierId: "party-supplier-001",
    businessDate: "2026-09-14",
    createdAt,
    sourceReference: {
      sourceSystem: "legacy-erp",
      sourceDocumentId: "legacy-55",
      sourceLineId: null,
    },
    correctionReference: {
      documentId: "purchase-doc-original",
      reason: "supplier correction",
    },
    lines: [],
  });

  assert.deepEqual(document.sourceReference, {
    sourceSystem: "legacy-erp",
    sourceDocumentId: "legacy-55",
    sourceLineId: null,
  });
  assert.deepEqual(document.correctionReference, {
    documentId: "purchase-doc-original",
    reason: "supplier correction",
  });

  assertDomainError(
    () => createPurchaseDocument({
      documentId: "purchase-doc-007",
      companyId: "company-001",
      supplierId: "party-supplier-001",
      businessDate: "2026-09-14",
      createdAt,
      correctionReference: {
        documentId: "purchase-doc-007",
        reason: "self",
      },
      lines: [],
    }),
    PURCHASE_DOMAIN_ERROR_CODES.selfReference,
    "correctionReference.documentId",
  );
});

test("rehydration rejects invalid versions and timestamp chronology", () => {
  const snapshot = createValidDocument();

  assertDomainError(
    () => rehydratePurchaseDocument({ ...snapshot, version: 0 }),
    PURCHASE_DOMAIN_ERROR_CODES.versionInvalid,
    "version",
  );

  assertDomainError(
    () => rehydratePurchaseDocument({
      ...snapshot,
      updatedAt: "2026-09-14T07:59:59.000Z",
    }),
    PURCHASE_DOMAIN_ERROR_CODES.timestampOrderInvalid,
    "updatedAt",
  );
});
