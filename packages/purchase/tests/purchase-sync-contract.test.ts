import assert from "node:assert/strict";
import test from "node:test";

import {
  PurchaseSyncContractError,
  createPurchaseCommercialFactSyncEnvelope,
  createPurchaseDocument,
  createPurchaseDocumentSyncTombstoneEnvelope,
  createPurchaseDocumentSyncUpsertEnvelope,
  createPurchaseReceiptInvoiceMatchSyncEnvelope,
  createPurchaseValuationCostInputSyncEnvelope,
  createPurchaseCommercialTerms,
} from "../src/index.ts";

const scope = {
  companyId: "company-1",
  branchId: "branch-1",
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
  companyId: "company-1",
  supplierId: "supplier-1",
  code: "SUP-1",
  displayName: "Supplier",
  classification: "legal-entity" as const,
  nationalCode: null,
  nationalId: "10101234567",
  economicNumber: null,
  taxFileNumber: null,
};
const itemSnapshot = {
  itemId: "product-1",
  itemType: "product" as const,
  code: "P-1",
  displayName: "Product",
  stockTracking: true,
  taxTreatment: "taxable" as const,
  vatRateBasisPoints: 1000,
  taxpayerGoodsServiceId: "2720000014385",
};
const unit = {
  unitId: "piece", code: "PCS", title: "Piece", ratioToBase: "1", precision: 0,
  roundingMode: "half-up" as const, taxpayerUnitCode: "1621",
};
const terms = createPurchaseCommercialTerms({
  enteredQuantity: "10",
  enteredUnit: unit,
  baseUnit: unit,
  unitPrice: { amount: 1000, currency: "IRR" },
  discounts: [],
  charges: [],
  tax: { treatment: "taxable", rateBasisPoints: 1000 },
});
const metadata = {
  operationId: "operation-1",
  requestId: "request-1",
  payloadFingerprint: "sha256:abc",
  changedAt: "2026-09-18T08:30:00.000Z",
  origin: { sourceSystem: "argin-desktop", sourceInstanceId: "device-1" },
} as const;

const draft = createPurchaseDocument({
  scope,
  documentId: "purchase-1",
  companyId: "company-1",
  supplierId: "supplier-1",
  supplierSnapshot,
  documentType: "supplier-invoice",
  documentNumber: "PINV-1",
  businessDate: "2026-09-18",
  createdAt: "2026-09-18T08:00:00.000Z",
  lines: [{
    lineId: "line-1",
    position: 1,
    lineKind: "stock-product",
    itemId: "product-1",
    itemSnapshot,
  }],
});

test("Purchase document upsert carries stable version and upstream master dependencies", () => {
  const envelope = createPurchaseDocumentSyncUpsertEnvelope({
    ...metadata,
    reference: {
      companyId: "company-1", branchId: "branch-1", documentId: "purchase-1",
      documentNumber: "PINV-1",
    },
    snapshot: draft,
  });

  assert.equal(envelope.contractVersion, 1);
  assert.equal(envelope.entity, "purchase-document");
  assert.equal(envelope.changeKind, "upsert");
  assert.equal(envelope.localVersion, 1);
  assert.deepEqual(envelope.dependencies, [
    { entity: "branch", id: "branch-1" },
    { entity: "fiscal-year", id: "fy-1405" },
    { entity: "fiscal-period", id: "fp-1405-06" },
    { entity: "party", id: "supplier-1" },
    { entity: "product", id: "product-1" },
  ]);
});

test("only a Draft Purchase document may produce a tombstone", () => {
  assert.throws(
    () => createPurchaseDocumentSyncTombstoneEnvelope({
      ...metadata,
      reference: {
        companyId: "company-1", branchId: "branch-1", documentId: "purchase-1",
        documentNumber: "PINV-1",
      },
      localVersion: 4,
      lastKnownStatus: "confirmed",
      deletedAt: "2026-09-18T08:20:00.000Z",
    }),
    (error: unknown) =>
      error instanceof PurchaseSyncContractError &&
      error.code === "purchase.sync.tombstone-invalid",
  );
});

test("Commercial Fact sync uses its Purchase line revision and depends on the owning document and line", () => {
  const envelope = createPurchaseCommercialFactSyncEnvelope({
    ...metadata,
    branchId: "branch-1",
    snapshot: {
      companyId: "company-1",
      purchaseDocumentId: "purchase-1",
      purchaseLineId: "line-1",
      commercialTerms: terms,
      revision: 3,
    },
  });

  assert.equal(envelope.entity, "purchase-commercial-fact");
  assert.equal(envelope.localRevision, 3);
  assert.deepEqual(envelope.dependencies, [
    { entity: "purchase-document", id: "purchase-1" },
    { entity: "purchase-line", id: "line-1" },
  ]);
});

test("Receipt/Invoice Match is an immutable revision-1 fact with Purchase and Inventory dependencies", () => {
  const envelope = createPurchaseReceiptInvoiceMatchSyncEnvelope({
    ...metadata,
    branchId: "branch-1",
    snapshot: {
      matchId: "match-1",
      companyId: "company-1",
      invoiceDocumentId: "purchase-1",
      invoiceLineId: "line-1",
      receiptDocumentId: "receipt-1",
      receiptLineId: "receipt-line-1",
      productId: "product-1",
      matchedBaseQuantity: "10",
    },
  });

  assert.equal(envelope.entity, "purchase-receipt-invoice-match");
  assert.equal(envelope.localRevision, 1);
  assert.deepEqual(envelope.dependencies, [
    { entity: "purchase-document", id: "purchase-1" },
    { entity: "purchase-line", id: "line-1" },
    { entity: "inventory-document", id: "receipt-1" },
    { entity: "inventory-line", id: "receipt-line-1" },
    { entity: "product", id: "product-1" },
  ]);
});

test("Valuation Cost Input sync depends on the movement, receipt and every Purchase match/source", () => {
  const envelope = createPurchaseValuationCostInputSyncEnvelope({
    ...metadata,
    branchId: "branch-1",
    localRevision: 2,
    snapshot: {
      costInputId: "cost-1",
      companyId: "company-1",
      movementId: "movement-1",
      receiptDocumentId: "receipt-1",
      receiptLineId: "receipt-line-1",
      productId: "product-1",
      sources: [{
        matchId: "match-1",
        purchaseDocumentId: "purchase-1",
        purchaseLineId: "line-1",
        receiptDocumentId: "receipt-1",
        receiptLineId: "receipt-line-1",
        productId: "product-1",
        matchedBaseQuantity: "10",
        allocatedBaseCost: 10000,
      }],
      basis: {
        basisLineId: "cost-1",
        movementId: "movement-1",
        productId: "product-1",
        warehouseId: "warehouse-1",
        quantity: "10",
        currency: "IRR",
        baseCost: 10000,
        landedCost: 0,
        totalCost: 10000,
        unitCost: "1000",
        allocations: [],
      },
    },
  });

  assert.equal(envelope.localRevision, 2);
  assert.deepEqual(envelope.dependencies, [
    { entity: "inventory-movement", id: "movement-1" },
    { entity: "inventory-document", id: "receipt-1" },
    { entity: "inventory-line", id: "receipt-line-1" },
    { entity: "product", id: "product-1" },
    { entity: "warehouse", id: "warehouse-1" },
    { entity: "purchase-match", id: "match-1" },
    { entity: "purchase-document", id: "purchase-1" },
    { entity: "purchase-line", id: "line-1" },
  ]);
});

test("Return and correction are synchronized as Purchase upserts, never as tombstones", () => {
  const returnedDocument = createPurchaseDocument({
    ...draft,
    documentId: "purchase-return-1",
    documentType: "purchase-return",
    documentNumber: "PRET-1",
    correctionReference: { documentId: "purchase-1", reason: "supplier return" },
    createdAt: "2026-09-18T09:00:00.000Z",
  });
  const envelope = createPurchaseDocumentSyncUpsertEnvelope({
    ...metadata,
    changedAt: "2026-09-18T09:00:00.000Z",
    reference: {
      companyId: "company-1", branchId: "branch-1", documentId: "purchase-return-1",
      documentNumber: "PRET-1",
    },
    snapshot: returnedDocument,
  });
  assert.equal(envelope.changeKind, "upsert");
  assert.deepEqual(envelope.dependencies.at(-1), { entity: "purchase-document", id: "purchase-1" });
});
