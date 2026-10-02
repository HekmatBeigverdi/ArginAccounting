import assert from "node:assert/strict";
import test from "node:test";
import {
  SalesDomainError,
  createSalesInvoice,
  createSalesOrder,
  createSalesReturn,
  matchSalesInvoiceReturns,
  matchSalesOrderInvoices,
} from "../src/index.ts";

const customer = { partyId: "p", code: "C", displayName: "Customer" };

function commercialTerms(quantity: number) {
  return {
    quantity,
    currency: "IRR",
    unitPrice: 100,
    priceOrigin: "manual" as const,
  };
}

function order(quantity = 10) {
  return createSalesOrder({
    documentId: "o1",
    companyId: "co",
    branchId: "b",
    fiscalYearId: "fy",
    customer,
    businessDate: "2026-10-02",
    capturedAt: "2026-10-02T10:00:00Z",
    lines: [
      {
        lineId: "ol1",
        position: 1,
        lineKind: "stock-product",
        productId: "prod",
        commercialTerms: commercialTerms(quantity),
      },
    ],
  });
}

function invoiceForOrder(id: string, quantity: number) {
  return createSalesInvoice({
    documentId: id,
    companyId: "co",
    branchId: "b",
    fiscalYearId: "fy",
    customer,
    businessDate: "2026-10-02",
    capturedAt: "2026-10-02T10:00:00Z",
    relatedDocumentReference: {
      documentId: "o1",
      relationType: "sales-order",
    },
    lines: [
      {
        lineId: `${id}-l1`,
        position: 1,
        lineKind: "stock-product",
        productId: "prod",
        sourceReference: {
          sourceSystem: "sales",
          sourceDocumentId: "o1",
          sourceLineId: "ol1",
        },
        commercialTerms: commercialTerms(quantity),
      },
    ],
  });
}

function standaloneInvoice(quantity = 5) {
  return createSalesInvoice({
    documentId: "inv-base",
    companyId: "co",
    branchId: "b",
    fiscalYearId: "fy",
    customer,
    businessDate: "2026-10-02",
    capturedAt: "2026-10-02T10:00:00Z",
    lines: [
      {
        lineId: "il1",
        position: 1,
        lineKind: "stock-product",
        productId: "prod",
        commercialTerms: commercialTerms(quantity),
      },
    ],
  });
}

function salesReturn(id: string, quantity: number) {
  return createSalesReturn({
    documentId: id,
    companyId: "co",
    branchId: "b",
    fiscalYearId: "fy",
    customer,
    businessDate: "2026-10-03",
    capturedAt: "2026-10-03T10:00:00Z",
    relatedDocumentReference: {
      documentId: "inv-base",
      relationType: "sales-invoice",
    },
    lines: [
      {
        lineId: `${id}-l1`,
        position: 1,
        lineKind: "stock-product",
        productId: "prod",
        sourceReference: {
          sourceSystem: "sales",
          sourceDocumentId: "inv-base",
          sourceLineId: "il1",
        },
        commercialTerms: commercialTerms(quantity),
      },
    ],
  });
}

test("aggregates partial invoices until the order line is completely fulfilled", () => {
  const result = matchSalesOrderInvoices(order(), [
    invoiceForOrder("i1", 6),
    invoiceForOrder("i2", 4),
  ]);

  assert.equal(result.complete, true);
  assert.equal(result.lines[0]?.matchedQuantity, 10);
  assert.equal(result.lines[0]?.remainingQuantity, 0);
});

test("reports partial order fulfillment", () => {
  const result = matchSalesOrderInvoices(order(), [invoiceForOrder("i1", 6)]);

  assert.equal(result.complete, false);
  assert.equal(result.lines[0]?.remainingQuantity, 4);
});

test("rejects cumulative over-invoicing", () => {
  assert.throws(
    () => matchSalesOrderInvoices(order(), [
      invoiceForOrder("i1", 6),
      invoiceForOrder("i2", 5),
    ]),
    (error: unknown) =>
      error instanceof SalesDomainError &&
      error.code === "sales.fulfillment_over_invoice",
  );
});

test("rejects invoice line mapped to the wrong order identity", () => {
  const invoiceWithMissingOrderLine = createSalesInvoice({
    documentId: "bad",
    companyId: "co",
    branchId: "b",
    fiscalYearId: "fy",
    customer,
    businessDate: "2026-10-02",
    capturedAt: "2026-10-02T10:00:00Z",
    relatedDocumentReference: {
      documentId: "o1",
      relationType: "sales-order",
    },
    lines: [
      {
        lineId: "bad-l",
        position: 1,
        lineKind: "stock-product",
        productId: "prod",
        sourceReference: {
          sourceSystem: "sales",
          sourceDocumentId: "o1",
          sourceLineId: "missing",
        },
        commercialTerms: commercialTerms(1),
      },
    ],
  });

  assert.throws(
    () => matchSalesOrderInvoices(order(), [invoiceWithMissingOrderLine]),
    (error: unknown) =>
      error instanceof SalesDomainError &&
      error.code === "sales.fulfillment_order_line_mismatch",
  );
});

test("aggregates multiple returns and exposes remaining returnable quantity", () => {
  const result = matchSalesInvoiceReturns(standaloneInvoice(), [
    salesReturn("r1", 2),
    salesReturn("r2", 1),
  ]);

  assert.equal(result.complete, false);
  assert.equal(result.lines[0]?.matchedQuantity, 3);
  assert.equal(result.lines[0]?.remainingQuantity, 2);
});

test("rejects cumulative over-return across multiple return documents", () => {
  assert.throws(
    () => matchSalesInvoiceReturns(standaloneInvoice(), [
      salesReturn("r1", 3),
      salesReturn("r2", 3),
    ]),
    (error: unknown) =>
      error instanceof SalesDomainError &&
      error.code === "sales.fulfillment_over_return",
  );
});
