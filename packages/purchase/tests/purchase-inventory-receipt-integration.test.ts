import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
  buildPurchaseInventoryReceiptRequest,
  createPurchaseCommercialTerms,
  createPurchaseDocument,
  stagePurchaseInventoryReceipt,
  submitPurchaseDocument,
  approvePurchaseDocument,
  confirmPurchaseDocument,
} from "../src/index.ts";
import type { PurchaseInventoryReceiptPort } from "../src/index.ts";

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
  lockedThroughDate: null,
};
const supplierSnapshot = {
  companyId: "company-001",
  supplierId: "supplier-001",
  code: "SUP-001",
  displayName: "Supplier 001",
  classification: "legal-entity" as const,
  nationalCode: null,
  nationalId: null,
  economicNumber: null,
  taxFileNumber: null,
};
const stockItemSnapshot = {
  itemId: "product-001",
  itemType: "product" as const,
  code: "P-001",
  displayName: "Stock Product",
  stockTracking: true,
  taxTreatment: "taxable" as const,
  vatRateBasisPoints: 1000,
};
const serviceItemSnapshot = {
  itemId: "service-001",
  itemType: "service" as const,
  code: "S-001",
  displayName: "Service",
  stockTracking: false,
  taxTreatment: "exempt" as const,
  vatRateBasisPoints: null,
};
const pieceUnit = {
  unitId: "piece",
  code: "PCS",
  title: "Piece",
  ratioToBase: "1",
  precision: 2,
  roundingMode: "half-up" as const,
  taxpayerUnitCode: "1621",
};
const stockTerms = createPurchaseCommercialTerms({
  enteredQuantity: "10",
  enteredUnit: pieceUnit,
  baseUnit: pieceUnit,
  unitPrice: { amount: 1000, currency: "IRR" },
  discounts: [],
  charges: [],
  tax: { treatment: "taxable", rateBasisPoints: 1000 },
});

function confirmedPurchase() {
  let purchase = createPurchaseDocument({
    scope,
    documentId: "purchase-001",
    companyId: "company-001",
    supplierId: "supplier-001",
    supplierSnapshot,
    documentType: "supplier-invoice",
    businessDate: "2026-09-15",
    createdAt: "2026-09-15T08:00:00.000Z",
    lines: [
      { lineId: "line-stock", position: 1, lineKind: "stock-product", itemId: "product-001", itemSnapshot: stockItemSnapshot },
      { lineId: "line-service", position: 2, lineKind: "service", itemId: "service-001", itemSnapshot: serviceItemSnapshot },
    ],
  });
  purchase = submitPurchaseDocument(purchase, { occurredAt: "2026-09-15T08:01:00.000Z", actorUserId: "user-1" });
  purchase = approvePurchaseDocument(purchase, { occurredAt: "2026-09-15T08:02:00.000Z", actorUserId: "user-1" });
  return confirmPurchaseDocument(purchase, { occurredAt: "2026-09-15T08:03:00.000Z", actorUserId: "user-1" });
}

const warehouse = { warehouseId: "warehouse-001", zoneId: null, locationId: null };

function input() {
  return {
    purchase: confirmedPurchase(),
    inventoryDocumentId: "inventory-receipt-001",
    commercialFacts: [{ purchaseLineId: "line-stock", commercialTerms: stockTerms }],
    allocations: [{ purchaseLineId: "line-stock", baseQuantity: "6", warehouse }],
    requestKey: "purchase-receipt-op-001",
    payloadFingerprint: "fingerprint-001",
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

test("builds an Inventory-owned receipt draft request from a confirmed Purchase stock line", () => {
  const request = buildPurchaseInventoryReceiptRequest(input());
  assert.deepEqual(request, {
    companyId: "company-001",
    inventoryDocumentId: "inventory-receipt-001",
    documentType: "receipt",
    businessDate: "2026-09-15",
    sourceSystem: "purchase",
    sourceDocumentType: "supplier-invoice",
    sourceDocumentId: "purchase-001",
    description: null,
    lines: [{
      sourceLineId: "line-stock",
      productId: "product-001",
      enteredQuantity: "6",
      unitId: "piece",
      warehouse,
      description: null,
    }],
    requestKey: "purchase-receipt-op-001",
    payloadFingerprint: "fingerprint-001",
  });
});

test("rejects staging from an unconfirmed Purchase document", () => {
  const draft = createPurchaseDocument({
    scope,
    documentId: "purchase-draft",
    companyId: "company-001",
    supplierId: "supplier-001",
    supplierSnapshot,
    documentType: "supplier-invoice",
    businessDate: "2026-09-15",
    createdAt: "2026-09-15T08:00:00.000Z",
    lines: [{ lineId: "line-stock", position: 1, lineKind: "stock-product", itemId: "product-001", itemSnapshot: stockItemSnapshot }],
  });
  assertDomainError(
    () => buildPurchaseInventoryReceiptRequest({ ...input(), purchase: draft }),
    PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptIneligible,
    "purchase.status",
  );
});

test("rejects non-stock lines and quantities above the Purchase commercial fact", () => {
  assertDomainError(
    () => buildPurchaseInventoryReceiptRequest({
      ...input(),
      commercialFacts: [{ purchaseLineId: "line-service", commercialTerms: stockTerms }],
      allocations: [{ purchaseLineId: "line-service", baseQuantity: "1", warehouse }],
    }),
    PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptIneligible,
    "allocations[0].purchaseLineId",
  );
  assertDomainError(
    () => buildPurchaseInventoryReceiptRequest({
      ...input(),
      allocations: [{ purchaseLineId: "line-stock", baseQuantity: "10.01", warehouse }],
    }),
    PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptQuantityExceeded,
    "allocations[0].baseQuantity",
  );
});

test("rejects duplicate Purchase line allocations in one receipt request", () => {
  assertDomainError(
    () => buildPurchaseInventoryReceiptRequest({
      ...input(),
      allocations: [
        { purchaseLineId: "line-stock", baseQuantity: "2", warehouse },
        { purchaseLineId: "line-stock", baseQuantity: "3", warehouse },
      ],
    }),
    PURCHASE_DOMAIN_ERROR_CODES.inventoryReceiptDuplicateLine,
    "allocations.purchaseLineId",
  );
});

test("stages through an InventorySourceDocumentPort-compatible boundary without creating stock movements directly", async () => {
  const requests: unknown[] = [];
  const port: PurchaseInventoryReceiptPort = {
    stageDraft: async request => {
      requests.push(request);
      return { inventoryDocumentId: request.inventoryDocumentId, status: "draft", version: 1 };
    },
  };
  const result = await stagePurchaseInventoryReceipt(port, input());
  assert.equal(requests.length, 1);
  assert.equal(result.inventoryDocumentId, "inventory-receipt-001");
  assert.equal(result.status, "draft");
  assert.equal(result.version, 1);
});
