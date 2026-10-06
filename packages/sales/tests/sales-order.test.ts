import assert from "node:assert/strict";
import test from "node:test";
import { SalesDomainError, createSalesOrder } from "../src/index.ts";

const customer = { partyId: "party-1", code: "C-1", displayName: "Customer" };

function input() {
  return {
    documentId: "so-1", companyId: "company-1", branchId: "branch-1", fiscalYearId: "fy-1",
    customer, documentNumber: "SO-0001", businessDate: "2026-10-01", capturedAt: "2026-10-01T12:00:00Z",
    lines: [{
      lineId: "line-1", position: 1, lineKind: "stock-product" as const, productId: "product-1",
      commercialTerms: {
        quantity: 2.5, currency: "IRR", unitPrice: 100, priceOrigin: "manual" as const,
        discounts: [{ id: "d", mode: "percent" as const, value: 1000 }],
        charges: [{ id: "c", mode: "amount" as const, value: 20 }],
        taxes: [{ taxId: "vat", rateBasisPoints: 1000 }],
      },
    }],
  };
}

test("creates a sales-order aggregate with commercial snapshots and totals", () => {
  const order = createSalesOrder(input());
  assert.equal(order.document.documentType, "sales-order");
  assert.equal(order.document.customer.partyId, "party-1");
  assert.equal(order.commercialSnapshots.length, 1);
  assert.equal(order.commercialSnapshots[0]?.snapshotId, "so-1:line-1:commercial");
  assert.equal(order.totals.grandTotal, 270);
  assert.equal(order.totals.lineCount, 1);
});

test("sales order supports stock non-stock and service commercial lines", () => {
  const base = input();
  const order = createSalesOrder({
    ...base,
    lines: [
      base.lines[0]!,
      { ...base.lines[0]!, lineId: "line-2", position: 2, lineKind: "non-stock-product" as const, productId: "product-2" },
      { ...base.lines[0]!, lineId: "line-3", position: 3, lineKind: "service" as const, productId: "service-1", itemType: "service" as const },
    ],
  });
  assert.equal(order.document.lines.length, 3);
  assert.equal(order.commercialSnapshots.length, 3);
});

test("rejects an empty sales order", () => {
  assert.throws(() => createSalesOrder({ ...input(), lines: [] }),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.order_lines_required");
});

test("rejects an order line without commercial terms", () => {
  const base = input();
  assert.throws(() => createSalesOrder({
    ...base,
    lines: [{ lineId: "line-x", position: 1, lineKind: "stock-product", productId: "product-x" }],
  }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.commercial_terms_required");
});

test("sales order has no inventory issue or accounting posting side effect", () => {
  const order = createSalesOrder(input());
  assert.equal("inventoryIssueId" in order, false);
  assert.equal("journalVoucherId" in order, false);
  assert.equal("cogs" in order, false);
});
