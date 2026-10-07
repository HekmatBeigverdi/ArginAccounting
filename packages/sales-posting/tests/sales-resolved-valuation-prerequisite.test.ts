import assert from "node:assert/strict";
import test from "node:test";

import type { InventoryValuationEntrySnapshot } from "@argin/inventory";
import { createSalesInvoice } from "@argin/sales";
import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  createSalesCommercialPostingInput,
  createSalesPostingSourceIdentity,
  resolveSalesResolvedValuationPrerequisite,
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

function movementLineage() {
  return {
    sourceDocumentId: "sales-invoice-001",
    companyId: "company-001",
    lines: [{
      salesLineId: "stock-1",
      productId: "product-001",
      inventoryDocumentId: "issue-001",
      inventoryLineId: "inventory-line-001",
      movementId: "movement-001",
      businessDate: "2026-10-06",
      businessOrder: 42,
      recordedAt: "2026-10-06T12:13:00.000Z",
      quantityDelta: "-2",
      warehouseId: "warehouse-001",
      zoneId: null,
      locationId: null,
    }],
  } as const;
}

function resolvedValuation(
  overrides: Partial<InventoryValuationEntrySnapshot> = {},
): InventoryValuationEntrySnapshot {
  return {
    valuationEntryId: "valuation-001",
    companyId: "company-001",
    productId: "product-001",
    stockKey: {
      companyId: "company-001",
      productId: "product-001",
      warehouseId: "warehouse-001",
      zoneId: null,
      locationId: null,
    },
    source: {
      movementId: "movement-001",
      documentId: "issue-001",
      lineId: "inventory-line-001",
      reversalOfMovementId: null,
      transferId: null,
    },
    kind: "outbound",
    method: "fifo",
    strategyVersion: 3,
    currency: "IRR",
    businessDate: "2026-10-06",
    businessOrder: 42,
    quantity: "2",
    unitCost: "600000",
    totalCost: -1_200_000,
    costState: "resolved",
    unresolvedReason: null,
    valuedAt: "2026-10-06T12:14:00.000Z",
    revision: 2,
    ...overrides,
  };
}

test("accepts resolved FIFO valuation for the exact outbound movement", async () => {
  const result = await resolveSalesResolvedValuationPrerequisite(
    commercial(),
    movementLineage(),
    {
      async findByMovement(companyId, movementId) {
        assert.equal(companyId, "company-001");
        assert.equal(movementId, "movement-001");
        return resolvedValuation();
      },
    },
  );

  assert.equal(result.ready, true);
  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0]!.valuationEntryId, "valuation-001");
  assert.equal(result.lines[0]!.method, "fifo");
  assert.equal(result.lines[0]!.totalCost, -1_200_000);
  assert.equal(result.lines[0]!.movementId, "movement-001");
});

test("also accepts resolved moving-average valuation", async () => {
  const result = await resolveSalesResolvedValuationPrerequisite(
    commercial(),
    movementLineage(),
    {
      async findByMovement() {
        return resolvedValuation({
          method: "moving_average",
          valuationEntryId: "valuation-mwa",
        });
      },
    },
  );

  assert.equal(result.lines[0]!.method, "moving_average");
});

test("service-only/no-stock movement lineage bypasses valuation lookup", async () => {
  const result = await resolveSalesResolvedValuationPrerequisite(
    commercial(),
    {
      sourceDocumentId: "sales-invoice-001",
      companyId: "company-001",
      lines: [],
    },
    {
      async findByMovement() {
        throw new Error("repository should not be called");
      },
    },
  );

  assert.equal(result.ready, true);
  assert.deepEqual(result.lines, []);
});

test("fails when valuation entry is missing or unresolved", async () => {
  await assert.rejects(
    () => resolveSalesResolvedValuationPrerequisite(
      commercial(),
      movementLineage(),
      { async findByMovement() { return null; } },
    ),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.valuationPrerequisiteMissing,
  );

  await assert.rejects(
    () => resolveSalesResolvedValuationPrerequisite(
      commercial(),
      movementLineage(),
      {
        async findByMovement() {
          return resolvedValuation({
            costState: "unresolved",
            unitCost: null,
            totalCost: null,
            valuedAt: null,
            unresolvedReason: "insufficient_cost_basis",
          });
        },
      },
    ),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.valuationPrerequisiteUnresolved,
  );
});

test("rejects wrong movement/document/line/product/warehouse lineage", async () => {
  const invalids: InventoryValuationEntrySnapshot[] = [
    resolvedValuation({
      source: { ...resolvedValuation().source, movementId: "movement-x" },
    }),
    resolvedValuation({
      source: { ...resolvedValuation().source, documentId: "issue-x" },
    }),
    resolvedValuation({
      source: { ...resolvedValuation().source, lineId: "line-x" },
    }),
    resolvedValuation({ productId: "product-x" }),
    resolvedValuation({
      stockKey: { ...resolvedValuation().stockKey, warehouseId: "warehouse-x" },
    }),
  ];

  for (const entry of invalids) {
    await assert.rejects(
      () => resolveSalesResolvedValuationPrerequisite(
        commercial(),
        movementLineage(),
        { async findByMovement() { return entry; } },
      ),
      (error: unknown) =>
        error instanceof SalesPostingDomainError
        && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.valuationPrerequisiteInvalid
        && error.field === "valuation",
    );
  }
});

test("rejects non-outbound, transfer, reversal or positive outbound cost", async () => {
  const invalids: InventoryValuationEntrySnapshot[] = [
    resolvedValuation({ kind: "inbound" }),
    resolvedValuation({
      source: { ...resolvedValuation().source, transferId: "transfer-1" },
    }),
    resolvedValuation({
      source: { ...resolvedValuation().source, reversalOfMovementId: "m0" },
    }),
    resolvedValuation({ totalCost: 1_200_000 }),
  ];

  for (const entry of invalids) {
    await assert.rejects(
      () => resolveSalesResolvedValuationPrerequisite(
        commercial(),
        movementLineage(),
        { async findByMovement() { return entry; } },
      ),
      (error: unknown) =>
        error instanceof SalesPostingDomainError
        && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.valuationPrerequisiteInvalid,
    );
  }
});

test("preserves valuation revision and strategy provenance without posting COGS yet", async () => {
  const result = await resolveSalesResolvedValuationPrerequisite(
    commercial(),
    movementLineage(),
    { async findByMovement() { return resolvedValuation(); } },
  );

  const line = result.lines[0]!;
  assert.equal(line.strategyVersion, 3);
  assert.equal(line.revision, 2);
  assert.equal(line.valuedAt, "2026-10-06T12:14:00.000Z");
  assert.equal("accountId" in line, false);
  assert.equal("debit" in line, false);
  assert.equal("credit" in line, false);
});
