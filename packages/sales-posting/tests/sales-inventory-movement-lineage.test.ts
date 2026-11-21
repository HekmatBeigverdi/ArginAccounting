import assert from "node:assert/strict";
import test from "node:test";

import { createInventoryStockMovement } from "@argin/inventory";
import { createSalesInvoice } from "@argin/sales";
import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  createSalesCommercialPostingInput,
  createSalesPostingSourceIdentity,
  resolveSalesOutboundInventoryMovementLineage,
} from "../src/index.ts";

function commercial() {
  const invoice = createSalesInvoice({
    documentId: "sales-invoice-001",
    companyId: "company-001",
    branchId: "branch-001",
    fiscalYearId: "fy-1405",
    customer: {
      partyId: "customer-001",
      code: "C-001",
      displayName: "Customer",
    },
    businessDate: "2026-10-06",
    capturedAt: "2026-10-06T12:00:00.000Z",
    lines: [{
      lineId: "stock-1",
      position: 1,
      lineKind: "stock-product",
      productId: "product-001",
      commercialTerms: {
        quantity: 2,
        currency: "IRR",
        unitPrice: 1_000_000,
        priceOrigin: "manual",
      },
    }],
  });

  return createSalesCommercialPostingInput({
    source: createSalesPostingSourceIdentity({
      sourceType: "sales-invoice",
      sourceDocumentId: invoice.document.documentId,
      sourceVersion: 1,
    }),
    document: invoice.document,
    commercialSnapshots: invoice.commercialSnapshots,
    documentTotals: invoice.totals,
  });
}

function issueLineage() {
  return {
    sourceDocumentId: "sales-invoice-001",
    companyId: "company-001",
    lines: [{
      salesLineId: "stock-1",
      productId: "product-001",
      inventoryDocumentId: "issue-001",
      inventoryDocumentVersion: 4,
      inventoryLineId: "inventory-line-001",
      confirmedAt: "2026-10-06T12:13:00.000Z",
    }],
  } as const;
}

function outboundMovement() {
  return createInventoryStockMovement({
    movementId: "movement-001",
    companyId: "company-001",
    documentId: "issue-001",
    lineId: "inventory-line-001",
    productId: "product-001",
    warehouse: {
      warehouseId: "warehouse-001",
      zoneId: null,
      locationId: null,
    },
    businessDate: "2026-10-06",
    businessOrder: 42,
    recordedAt: "2026-10-06T12:13:00.000Z",
    quantityDelta: "-2",
  });
}

test("resolves exact outbound movement for confirmed issue line", async () => {
  const result = await resolveSalesOutboundInventoryMovementLineage(
    commercial(),
    issueLineage(),
    {
      async listByDocument(companyId, documentId) {
        assert.equal(companyId, "company-001");
        assert.equal(documentId, "issue-001");
        return [outboundMovement()];
      },
    },
  );

  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0]!.movementId, "movement-001");
  assert.equal(result.lines[0]!.quantityDelta, "-2");
  assert.equal(result.lines[0]!.warehouseId, "warehouse-001");
  assert.equal(result.lines[0]!.businessOrder, 42);
});

test("returns empty movement lineage for service-only/no stock lineage", async () => {
  const result = await resolveSalesOutboundInventoryMovementLineage(
    commercial(),
    {
      sourceDocumentId: "sales-invoice-001",
      companyId: "company-001",
      lines: [],
    },
    {
      async listByDocument() {
        throw new Error("reader should not be called");
      },
    },
  );

  assert.deepEqual(result.lines, []);
});

test("rejects missing or ambiguous movement for issue line", async () => {
  await assert.rejects(
    () => resolveSalesOutboundInventoryMovementLineage(
      commercial(),
      issueLineage(),
      { async listByDocument() { return []; } },
    ),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.inventoryMovementLineageMissing,
  );

  await assert.rejects(
    () => resolveSalesOutboundInventoryMovementLineage(
      commercial(),
      issueLineage(),
      {
        async listByDocument() {
          return [
            outboundMovement(),
            { ...outboundMovement(), movementId: "movement-002" },
          ];
        },
      },
    ),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.inventoryMovementLineageAmbiguous,
  );
});

test("rejects non-outbound movement direction", async () => {
  const inbound = {
    ...outboundMovement(),
    quantityDelta: "2",
  };

  await assert.rejects(
    () => resolveSalesOutboundInventoryMovementLineage(
      commercial(),
      issueLineage(),
      { async listByDocument() { return [inbound]; } },
    ),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.inventoryMovementLineageInvalid
      && error.field === "movement.quantityDelta",
  );
});

test("rejects product, business date, confirmation time, transfer or reversal mismatch", async () => {
  const invalids = [
    {
      ...outboundMovement(),
      stockKey: {
        ...outboundMovement().stockKey,
        productId: "another-product",
      },
    },
    {
      ...outboundMovement(),
      businessDate: "2026-10-07",
    },
    {
      ...outboundMovement(),
      recordedAt: "2026-10-06T12:14:00.000Z",
    },
    {
      ...outboundMovement(),
      transferId: "transfer-001",
    },
    {
      ...outboundMovement(),
      reversalOfMovementId: "movement-original",
    },
  ];

  for (const movement of invalids) {
    await assert.rejects(
      () => resolveSalesOutboundInventoryMovementLineage(
        commercial(),
        issueLineage(),
        { async listByDocument() { return [movement]; } },
      ),
      (error: unknown) =>
        error instanceof SalesPostingDomainError
        && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.inventoryMovementLineageInvalid
        && error.field === "movement",
    );
  }
});

test("rejects issue lineage from another company or Sales source", async () => {
  for (const lineage of [
    { ...issueLineage(), companyId: "company-999" },
    { ...issueLineage(), sourceDocumentId: "another-invoice" },
  ]) {
    await assert.rejects(
      () => resolveSalesOutboundInventoryMovementLineage(
        commercial(),
        lineage,
        { async listByDocument() { return [outboundMovement()]; } },
      ),
      (error: unknown) =>
        error instanceof SalesPostingDomainError
        && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.inventoryMovementLineageInvalid
        && error.field === "issueLineage.source",
    );
  }
});

test("preserves Inventory movement identity and contains no valuation amount", async () => {
  const result = await resolveSalesOutboundInventoryMovementLineage(
    commercial(),
    issueLineage(),
    { async listByDocument() { return [outboundMovement()]; } },
  );

  const movement = result.lines[0]!;
  assert.equal(movement.inventoryDocumentId, "issue-001");
  assert.equal(movement.inventoryLineId, "inventory-line-001");
  assert.equal(movement.salesLineId, "stock-1");
  assert.equal("cost" in movement, false);
  assert.equal("valuation" in movement, false);
  assert.equal("amount" in movement, false);
});
