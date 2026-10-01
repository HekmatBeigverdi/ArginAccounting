import assert from "node:assert/strict";
import test from "node:test";
import {
  InventorySalesIssueGateway,
  SalesDomainError,
  createSalesInvoice,
  createSalesLifecycle,
  transitionSalesLifecycle,
} from "../src/index.ts";

const customer = { partyId: "party-1", code: "C-1", displayName: "Customer" };
function invoice() {
  return createSalesInvoice({
    documentId: "inv-1", companyId: "co-1", branchId: "br-1", fiscalYearId: "fy-1", customer,
    businessDate: "2026-10-01", capturedAt: "2026-10-01T10:00:00Z",
    lines: [
      { lineId: "stock-1", position: 1, lineKind: "stock-product", productId: "p-1", commercialTerms: { quantity: 2.5, currency: "IRR", unitPrice: 100, priceOrigin: "manual" } },
      { lineId: "nonstock-1", position: 2, lineKind: "non-stock-product", productId: "p-2", commercialTerms: { quantity: 3, currency: "IRR", unitPrice: 200, priceOrigin: "manual" } },
      { lineId: "service-1", position: 3, lineKind: "service", itemType: "service", productId: "s-1", commercialTerms: { quantity: 1, currency: "IRR", unitPrice: 500, priceOrigin: "manual" } },
    ],
  });
}
function finalized(documentId = "inv-1") {
  let state = createSalesLifecycle(documentId, "sales-invoice");
  state = transitionSalesLifecycle(state, { transitionId: "t1", action: "submit", actorId: "u", occurredAt: "2026-10-01T11:00:00Z" });
  state = transitionSalesLifecycle(state, { transitionId: "t2", action: "approve", actorId: "u", occurredAt: "2026-10-01T11:01:00Z" });
  return transitionSalesLifecycle(state, { transitionId: "t3", action: "finalize", actorId: "u", occurredAt: "2026-10-01T11:02:00Z" });
}

test("stages only stock-product lines as an Inventory issue through the public port", async () => {
  let captured: unknown;
  const gateway = new InventorySalesIssueGateway({
    async stageDraft(request) { captured = request; return { inventoryDocumentId: request.inventoryDocumentId, status: "draft", version: 1 }; },
  });
  const result = await gateway.stage({
    invoice: invoice(), lifecycle: finalized(), inventoryDocumentId: "issue-1",
    lineRouting: [{ salesLineId: "stock-1", unitId: "unit-each", warehouse: { warehouseId: "wh-1" } }],
    requestKey: "req-1", payloadFingerprint: "fp-1",
  });
  assert.equal(result.inventoryDocumentId, "issue-1");
  const request = captured as { documentType: string; sourceDocumentId: string; lines: readonly { sourceLineId: string; enteredQuantity: string; productId: string; [key: string]: unknown }[] };
  assert.equal(request.documentType, "issue");
  assert.equal(request.sourceDocumentId, "inv-1");
  assert.equal(request.lines.length, 1);
  assert.equal(request.lines[0]?.sourceLineId, "stock-1");
  assert.equal(request.lines[0]?.enteredQuantity, "2.5");
  assert.equal(request.lines[0]?.productId, "p-1");
  assert.equal("unitPrice" in request.lines[0]!, false);
  assert.equal("taxes" in request.lines[0]!, false);
});

test("requires a finalized lifecycle belonging to the same sales invoice", async () => {
  const gateway = new InventorySalesIssueGateway({ async stageDraft() { throw new Error("must not call inventory"); } });
  await assert.rejects(() => gateway.stage({
    invoice: invoice(), lifecycle: createSalesLifecycle("inv-1", "sales-invoice"), inventoryDocumentId: "issue-1",
    lineRouting: [{ salesLineId: "stock-1", unitId: "u", warehouse: { warehouseId: "wh-1" } }],
    requestKey: "r", payloadFingerprint: "f",
  }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.inventory_issue_finalized_invoice_required");
});

test("requires exact routing for every and only stock line", async () => {
  const gateway = new InventorySalesIssueGateway({ async stageDraft() { throw new Error("must not call inventory"); } });
  await assert.rejects(() => gateway.stage({
    invoice: invoice(), lifecycle: finalized(), inventoryDocumentId: "issue-1", lineRouting: [],
    requestKey: "r", payloadFingerprint: "f",
  }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.inventory_issue_routing_mismatch");
});

test("does not stage inventory for invoices without stock-product lines", async () => {
  const base = invoice();
  const noStock = createSalesInvoice({
    documentId: "inv-2", companyId: "co-1", branchId: "br-1", fiscalYearId: "fy-1", customer,
    businessDate: "2026-10-01", capturedAt: "2026-10-01T10:00:00Z",
    lines: base.document.lines.filter(x => x.lineKind !== "stock-product").map(x => ({
      lineId: x.lineId, position: x.position, lineKind: x.lineKind, productId: x.item.productId, itemType: x.item.itemType,
      commercialTerms: x.commercialTerms!,
    })),
  });
  const gateway = new InventorySalesIssueGateway({ async stageDraft() { throw new Error("must not call inventory"); } });
  await assert.rejects(() => gateway.stage({
    invoice: noStock, lifecycle: finalized("inv-2"), inventoryDocumentId: "issue-2", lineRouting: [],
    requestKey: "r2", payloadFingerprint: "f2",
  }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.inventory_issue_stock_lines_required");
});
