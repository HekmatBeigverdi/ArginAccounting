import assert from "node:assert/strict";
import test from "node:test";
import {
  InventorySalesReturnReceiptGateway,
  SalesDomainError,
  createSalesLifecycle,
  createSalesReturn,
  transitionSalesLifecycle,
} from "../src/index.ts";

const customer = { partyId: "party-1", code: "C-1", displayName: "Customer" };

function salesReturn() {
  return createSalesReturn({
    documentId: "ret-1", companyId: "co-1", branchId: "br-1", fiscalYearId: "fy-1", customer,
    businessDate: "2026-10-02", capturedAt: "2026-10-02T10:00:00Z",
    relatedDocumentReference: { documentId: "inv-1", relationType: "sales-invoice" },
    lines: [
      {
        lineId: "ret-stock-1", position: 1, lineKind: "stock-product", productId: "p-1",
        sourceReference: { sourceSystem: "sales", sourceDocumentId: "inv-1", sourceLineId: "inv-line-1" },
        commercialTerms: { quantity: 1.5, currency: "IRR", unitPrice: 100, priceOrigin: "manual" },
      },
      {
        lineId: "ret-service-1", position: 2, lineKind: "service", itemType: "service", productId: "s-1",
        sourceReference: { sourceSystem: "sales", sourceDocumentId: "inv-1", sourceLineId: "inv-line-2" },
        commercialTerms: { quantity: 1, currency: "IRR", unitPrice: 300, priceOrigin: "manual" },
      },
    ],
  });
}

function finalized(documentId = "ret-1") {
  let state = createSalesLifecycle(documentId, "sales-return");
  state = transitionSalesLifecycle(state, { transitionId: "t1", action: "submit", actorId: "u", occurredAt: "2026-10-02T11:00:00Z" });
  state = transitionSalesLifecycle(state, { transitionId: "t2", action: "approve", actorId: "u", occurredAt: "2026-10-02T11:01:00Z" });
  return transitionSalesLifecycle(state, { transitionId: "t3", action: "finalize", actorId: "u", occurredAt: "2026-10-02T11:02:00Z" });
}

test("stages only returned stock-product lines as an Inventory receipt", async () => {
  let captured: unknown;
  const gateway = new InventorySalesReturnReceiptGateway({
    async stageDraft(request) {
      captured = request;
      return { inventoryDocumentId: request.inventoryDocumentId, status: "draft", version: 1 };
    },
  });

  const result = await gateway.stage({
    salesReturn: salesReturn(), lifecycle: finalized(), inventoryDocumentId: "receipt-1",
    lineRouting: [{ salesReturnLineId: "ret-stock-1", unitId: "unit-each", warehouse: { warehouseId: "wh-1" } }],
    requestKey: "req-1", payloadFingerprint: "fp-1",
  });

  assert.equal(result.inventoryDocumentId, "receipt-1");
  const request = captured as {
    documentType: string; sourceDocumentType: string; sourceDocumentId: string;
    lines: readonly { sourceLineId: string; enteredQuantity: string; productId: string; [key: string]: unknown }[];
  };
  assert.equal(request.documentType, "receipt");
  assert.equal(request.sourceDocumentType, "sales-return");
  assert.equal(request.sourceDocumentId, "ret-1");
  assert.equal(request.lines.length, 1);
  assert.equal(request.lines[0]?.sourceLineId, "ret-stock-1");
  assert.equal(request.lines[0]?.enteredQuantity, "1.5");
  assert.equal(request.lines[0]?.productId, "p-1");
  assert.equal("unitPrice" in request.lines[0]!, false);
  assert.equal("taxes" in request.lines[0]!, false);
});

test("requires the finalized lifecycle of the same Sales Return", async () => {
  const gateway = new InventorySalesReturnReceiptGateway({ async stageDraft() { throw new Error("must not call inventory"); } });
  await assert.rejects(() => gateway.stage({
    salesReturn: salesReturn(), lifecycle: createSalesLifecycle("ret-1", "sales-return"),
    inventoryDocumentId: "receipt-1",
    lineRouting: [{ salesReturnLineId: "ret-stock-1", unitId: "u", warehouse: { warehouseId: "wh-1" } }],
    requestKey: "r", payloadFingerprint: "f",
  }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.inventory_return_receipt_finalized_return_required");
});

test("requires exact routing for every and only returned stock line", async () => {
  const gateway = new InventorySalesReturnReceiptGateway({ async stageDraft() { throw new Error("must not call inventory"); } });
  await assert.rejects(() => gateway.stage({
    salesReturn: salesReturn(), lifecycle: finalized(), inventoryDocumentId: "receipt-1",
    lineRouting: [], requestKey: "r", payloadFingerprint: "f",
  }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.inventory_return_receipt_routing_mismatch");
});

test("does not create an Inventory receipt for a return with no stock-product lines", async () => {
  const noStock = createSalesReturn({
    documentId: "ret-2", companyId: "co-1", branchId: "br-1", fiscalYearId: "fy-1", customer,
    businessDate: "2026-10-02", capturedAt: "2026-10-02T10:00:00Z",
    relatedDocumentReference: { documentId: "inv-1", relationType: "sales-invoice" },
    lines: [{
      lineId: "service-only", position: 1, lineKind: "service", itemType: "service", productId: "s-1",
      sourceReference: { sourceSystem: "sales", sourceDocumentId: "inv-1", sourceLineId: "inv-service-1" },
      commercialTerms: { quantity: 1, currency: "IRR", unitPrice: 300, priceOrigin: "manual" },
    }],
  });
  const gateway = new InventorySalesReturnReceiptGateway({ async stageDraft() { throw new Error("must not call inventory"); } });
  await assert.rejects(() => gateway.stage({
    salesReturn: noStock, lifecycle: finalized("ret-2"), inventoryDocumentId: "receipt-2",
    lineRouting: [], requestKey: "r2", payloadFingerprint: "f2",
  }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.inventory_return_receipt_stock_lines_required");
});
