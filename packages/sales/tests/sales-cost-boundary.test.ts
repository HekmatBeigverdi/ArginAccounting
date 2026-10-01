import assert from "node:assert/strict";
import test from "node:test";
import {
  SalesDomainError,
  createSalesCommercialAmountFact,
  createSalesCommercialSnapshot,
  createSalesDocumentLine,
  createSalesInventoryCostFact,
} from "../src/index.ts";
import type { InventoryValuationEntrySnapshot } from "@argin/inventory";

function commercial() {
  const line = createSalesDocumentLine({
    lineId: "sales-line-1", position: 1, lineKind: "stock-product", productId: "p-1",
    commercialTerms: {
      quantity: 2, currency: "IRR", unitPrice: 500_000, priceOrigin: "manual",
      discounts: [], charges: [], taxes: [],
    },
  });
  return createSalesCommercialSnapshot({
    snapshotId: "snap-1", line, capturedAt: "2026-10-02T12:00:00Z",
  });
}

function valuation(overrides: Partial<InventoryValuationEntrySnapshot> = {}): InventoryValuationEntrySnapshot {
  return {
    valuationEntryId: "val-1", companyId: "co-1", productId: "p-1",
    stockKey: { productId: "p-1", warehouseId: "wh-1", zoneId: null, locationId: null },
    source: { movementId: "mov-1", documentId: "issue-1", lineId: "sales-line-1", reversalOfMovementId: null, transferId: null },
    kind: "outbound", method: "fifo", strategyVersion: 1, currency: "IRR",
    businessDate: "2026-10-02", businessOrder: 1, quantity: "2",
    unitCost: "262000", totalCost: 524000, costState: "resolved",
    unresolvedReason: null, valuedAt: "2026-10-02T12:05:00.000Z", revision: 1,
    ...overrides,
  };
}

test("commercial fact preserves selling price without inventing inventory cost", () => {
  const fact = createSalesCommercialAmountFact("inv-1", commercial());
  assert.equal(fact.source, "sales-commercial");
  assert.equal(fact.unitSellingPrice, 500_000);
  assert.equal(fact.grandTotal, 1_000_000);
  assert.equal("unitCost" in fact, false);
  assert.equal("cogs" in fact, false);
});

test("inventory cost fact comes only from resolved outbound valuation", () => {
  const fact = createSalesInventoryCostFact({
    salesDocumentId: "inv-1", salesLineId: "sales-line-1", valuation: valuation(),
  });
  assert.equal(fact.source, "inventory-valuation");
  assert.equal(fact.unitCost, "262000");
  assert.equal(fact.totalCost, 524000);
  assert.equal(fact.valuationMethod, "fifo");
  assert.equal("unitSellingPrice" in fact, false);
  assert.equal("grandTotal" in fact, false);
});

test("selling price and inventory cost remain independent values", () => {
  const sale = createSalesCommercialAmountFact("inv-1", commercial());
  const cost = createSalesInventoryCostFact({
    salesDocumentId: "inv-1", salesLineId: "sales-line-1", valuation: valuation(),
  });
  assert.equal(sale.unitSellingPrice, 500_000);
  assert.equal(cost.unitCost, "262000");
  assert.notEqual(String(sale.unitSellingPrice), cost.unitCost);
});

test("rejects unresolved or non-outbound valuation as COGS source", () => {
  assert.throws(() => createSalesInventoryCostFact({
    salesDocumentId: "inv-1", salesLineId: "sales-line-1",
    valuation: valuation({ costState: "unresolved", unitCost: null, totalCost: null, unresolvedReason: "waiting" }),
  }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.inventory_cost_resolved_outbound_required");

  assert.throws(() => createSalesInventoryCostFact({
    salesDocumentId: "inv-1", salesLineId: "sales-line-1", valuation: valuation({ kind: "inbound" }),
  }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.inventory_cost_resolved_outbound_required");
});

test("rejects valuation whose source line does not match the Sales line", () => {
  assert.throws(() => createSalesInventoryCostFact({
    salesDocumentId: "inv-1", salesLineId: "sales-line-1",
    valuation: valuation({ source: { movementId: "mov-x", documentId: "issue-x", lineId: "other-line", reversalOfMovementId: null, transferId: null } }),
  }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.inventory_cost_lineage_mismatch");
});
