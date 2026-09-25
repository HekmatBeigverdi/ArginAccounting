import assert from "node:assert/strict";
import test from "node:test";

import {
  createPurchaseFulfillmentAccountingPolicy,
  evaluateSupplierInvoiceAccountingEligibility,
} from "../src/index.ts";

test("stock supplier invoice is blocked until the receipt is complete", () => {
  const policy = createPurchaseFulfillmentAccountingPolicy("automatic");

  const missing = evaluateSupplierInvoiceAccountingEligibility({
    sourceStatus: "confirmed",
    policy,
    lines: [
      {
        purchaseLineId: "line-1",
        lineKind: "stock-product",
        fulfillmentState: "not-received",
      },
    ],
  });
  assert.equal(missing.status, "blocked");
  assert.equal(missing.reasonCode, "stock_receipt_missing");

  const partial = evaluateSupplierInvoiceAccountingEligibility({
    sourceStatus: "confirmed",
    policy,
    lines: [
      {
        purchaseLineId: "line-1",
        lineKind: "stock-product",
        fulfillmentState: "partially-received",
      },
    ],
  });
  assert.equal(partial.status, "blocked");
  assert.equal(partial.reasonCode, "stock_receipt_partial");

  const complete = evaluateSupplierInvoiceAccountingEligibility({
    sourceStatus: "confirmed",
    policy,
    lines: [
      {
        purchaseLineId: "line-1",
        lineKind: "stock-product",
        fulfillmentState: "fully-received",
      },
    ],
  });
  assert.equal(complete.status, "ready-for-automatic-posting");
  assert.equal(complete.shouldPostAutomatically, true);
});

test("service and non-stock lines never require an Inventory receipt", () => {
  const result = evaluateSupplierInvoiceAccountingEligibility({
    sourceStatus: "confirmed",
    policy: createPurchaseFulfillmentAccountingPolicy("automatic"),
    lines: [
      {
        purchaseLineId: "service-1",
        lineKind: "service",
        fulfillmentState: "not-required",
      },
      {
        purchaseLineId: "non-stock-1",
        lineKind: "non-stock-product",
        fulfillmentState: "not-required",
      },
    ],
  });

  assert.equal(result.status, "ready-for-automatic-posting");
  assert.equal(result.lines.every((line) => line.receiptRequired === false), true);
});

test("mixed invoice waits only for stock fulfillment but becomes eligible as one invoice", () => {
  const policy = createPurchaseFulfillmentAccountingPolicy("automatic");

  const blocked = evaluateSupplierInvoiceAccountingEligibility({
    sourceStatus: "confirmed",
    policy,
    lines: [
      {
        purchaseLineId: "stock-1",
        lineKind: "stock-product",
        fulfillmentState: "partially-received",
      },
      {
        purchaseLineId: "service-1",
        lineKind: "service",
        fulfillmentState: "not-required",
      },
    ],
  });
  assert.equal(blocked.status, "blocked");

  const ready = evaluateSupplierInvoiceAccountingEligibility({
    sourceStatus: "confirmed",
    policy,
    lines: [
      {
        purchaseLineId: "stock-1",
        lineKind: "stock-product",
        fulfillmentState: "fully-received",
      },
      {
        purchaseLineId: "service-1",
        lineKind: "service",
        fulfillmentState: "not-required",
      },
    ],
  });
  assert.equal(ready.status, "ready-for-automatic-posting");
});

test("accountant approval mode gates Journal creation without manual Journal entry", () => {
  const result = evaluateSupplierInvoiceAccountingEligibility({
    sourceStatus: "confirmed",
    policy: createPurchaseFulfillmentAccountingPolicy("accountant-approval"),
    lines: [
      {
        purchaseLineId: "service-1",
        lineKind: "service",
        fulfillmentState: "not-required",
      },
    ],
  });

  assert.equal(result.status, "awaiting-accountant-approval");
  assert.equal(result.requiresAccountantApproval, true);
  assert.equal(result.shouldPostAutomatically, false);
});

test("non-confirmed invoice is never eligible even when fulfillment is complete", () => {
  for (const sourceStatus of ["returned", "corrected"] as const) {
    const result = evaluateSupplierInvoiceAccountingEligibility({
      sourceStatus,
      policy: createPurchaseFulfillmentAccountingPolicy("automatic"),
      lines: [
        {
          purchaseLineId: "stock-1",
          lineKind: "stock-product",
          fulfillmentState: "fully-received",
        },
      ],
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.reasonCode, "source_not_confirmed");
  }
});

test("rejects inconsistent fulfillment declarations", () => {
  const policy = createPurchaseFulfillmentAccountingPolicy("automatic");

  assert.throws(
    () =>
      evaluateSupplierInvoiceAccountingEligibility({
        sourceStatus: "confirmed",
        policy,
        lines: [
          {
            purchaseLineId: "service-1",
            lineKind: "service",
            fulfillmentState: "fully-received",
          },
        ],
      }),
    /purchase_posting\.input_invalid:lines\.fulfillmentState/u,
  );

  assert.throws(
    () =>
      evaluateSupplierInvoiceAccountingEligibility({
        sourceStatus: "confirmed",
        policy,
        lines: [
          {
            purchaseLineId: "stock-1",
            lineKind: "stock-product",
            fulfillmentState: "not-required",
          },
        ],
      }),
    /purchase_posting\.input_invalid:lines\.fulfillmentState/u,
  );
});
