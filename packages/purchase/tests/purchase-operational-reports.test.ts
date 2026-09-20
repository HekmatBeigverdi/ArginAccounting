import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPurchaseDocumentRegisterRow,
  buildPurchaseSupplierActivitySummary,
  calculatePurchaseMatchingStatus,
  normalizePurchaseOperationalReportQuery,
  type PurchaseDocumentSnapshot,
  type PurchaseCommercialFactSnapshot,
} from "../src/index.ts";

const scope = {
  companyId: "company-1",
  branchId: "branch-1",
  fiscalYearId: "fy-1",
  fiscalPeriodId: "fp-1",
  fiscalYearStartDate: "2026-03-21",
  fiscalYearEndDate: "2027-03-20",
  fiscalPeriodStartDate: "2026-09-01",
  fiscalPeriodEndDate: "2026-09-30",
  fiscalYearStatus: "open" as const,
  fiscalPeriodStatus: "open" as const,
  lockedThroughDate: null,
};

const supplier = {
  companyId: "company-1",
  supplierId: "supplier-1",
  code: "SUP-001",
  displayName: "تأمین‌کننده نمونه",
  classification: "legal-entity" as const,
  nationalCode: null,
  nationalId: "10101010101",
  economicNumber: null,
  taxFileNumber: null,
};

function document(input: {
  id: string;
  type: PurchaseDocumentSnapshot["documentType"];
  status?: PurchaseDocumentSnapshot["status"];
}): PurchaseDocumentSnapshot {
  return {
    scope,
    documentId: input.id,
    companyId: "company-1",
    supplierId: "supplier-1",
    supplierSnapshot: supplier,
    documentType: input.type,
    status: input.status ?? "confirmed",
    lifecycleHistory: [],
    documentNumber: input.id.toUpperCase(),
    businessDate: "2026-09-20",
    description: null,
    sourceReference: null,
    correctionReference: input.type === "purchase-return" || input.type === "purchase-correction"
      ? { documentId: "invoice-1", reason: "اصلاح" }
      : null,
    lines: [{
      lineId: input.id + "-line-1",
      position: 1,
      lineKind: "stock-product",
      itemType: "product",
      itemId: "product-1",
      itemSnapshot: {
        itemId: "product-1",
        itemType: "product",
        code: "P-1",
        displayName: "کالا",
        sku: null,
        referenceCode: null,
        taxpayerGoodsServiceId: null,
        purchaseDescription: null,
        brand: null,
        model: null,
        stockTracking: true,
        taxTreatment: "taxable",
        vatRateBasisPoints: 1000,
        defaultPurchaseUnit: {
          unitId: "unit-1",
          code: "PCS",
          title: "عدد",
          taxpayerUnitCode: null,
        },
      },
      description: null,
      sourceReference: null,
    }],
    version: 4,
    createdAt: "2026-09-20T08:00:00.000Z",
    updatedAt: "2026-09-20T08:30:00.000Z",
  };
}

function fact(doc: PurchaseDocumentSnapshot, quantity = "2", price = 1000): PurchaseCommercialFactSnapshot {
  return {
    companyId: doc.companyId,
    purchaseDocumentId: doc.documentId,
    purchaseLineId: doc.lines[0]!.lineId,
    revision: 1,
    commercialTerms: {
      quantity: {
        enteredQuantity: quantity,
        baseQuantity: quantity,
        enteredUnit: {
          unitId: "unit-1",
          code: "PCS",
          title: "عدد",
          ratioToBase: "1",
          precision: 0,
          roundingMode: "half-up",
          taxpayerUnitCode: null,
        },
        baseUnit: {
          unitId: "unit-1",
          code: "PCS",
          title: "عدد",
          ratioToBase: "1",
          precision: 0,
          roundingMode: "half-up",
          taxpayerUnitCode: null,
        },
      },
      unitPrice: { amount: price, currency: "IRR" },
      discounts: [{ kind: "percentage", rateBasisPoints: 1000 }],
      charges: [{ kind: "fixed", amount: { amount: 100, currency: "IRR" } }],
      tax: { treatment: "taxable", rateBasisPoints: 1000 },
      moneyRoundingMode: "half-away-from-zero",
    },
  };
}

test("normalizes operational report scope with bounded paging and date range", () => {
  assert.deepEqual(
    normalizePurchaseOperationalReportQuery({
      companyId: " company-1 ",
      branchId: " branch-1 ",
      fiscalYearId: " fy-1 ",
      supplierId: null,
      fromBusinessDate: "2026-09-01",
      toBusinessDate: "2026-09-30",
      limit: 50,
      offset: 100,
    }),
    {
      companyId: "company-1",
      branchId: "branch-1",
      fiscalYearId: "fy-1",
      supplierId: null,
      fromBusinessDate: "2026-09-01",
      toBusinessDate: "2026-09-30",
      limit: 50,
      offset: 100,
    },
  );

  assert.throws(() => normalizePurchaseOperationalReportQuery({
    companyId: "company-1",
    fromBusinessDate: "2026-10-01",
    toBusinessDate: "2026-09-01",
  }), /businessDateRange/u);
  assert.throws(() => normalizePurchaseOperationalReportQuery({
    companyId: "company-1",
    limit: 501,
  }), /limit/u);
});

test("document register derives exact commercial totals from authoritative facts", () => {
  const invoice = document({ id: "invoice-1", type: "supplier-invoice" });
  const row = buildPurchaseDocumentRegisterRow(invoice, [fact(invoice)]);
  assert.equal(row.currency, "IRR");
  assert.equal(row.grossAmount, 2000);
  assert.equal(row.discountAmount, 200);
  assert.equal(row.chargeAmount, 100);
  assert.equal(row.taxBaseAmount, 1900);
  assert.equal(row.taxAmount, 190);
  assert.equal(row.grandTotal, 2090);
  assert.equal(row.lineCount, 1);
  assert.equal(row.supplierDisplayName, "تأمین‌کننده نمونه");
});

test("supplier activity keeps corrections separate and nets confirmed returns only", () => {
  const invoice = document({ id: "invoice-1", type: "supplier-invoice" });
  const returned = document({ id: "return-1", type: "purchase-return" });
  const correction = document({ id: "correction-1", type: "purchase-correction" });

  const rows = [
    buildPurchaseDocumentRegisterRow(invoice, [fact(invoice, "2", 1000)]),
    buildPurchaseDocumentRegisterRow(returned, [fact(returned, "1", 1000)]),
    buildPurchaseDocumentRegisterRow(correction, [fact(correction, "1", 1200)]),
  ];
  const summary = buildPurchaseSupplierActivitySummary(rows);
  assert.equal(summary.length, 1);
  assert.equal(summary[0]!.invoiceCount, 1);
  assert.equal(summary[0]!.returnCount, 1);
  assert.equal(summary[0]!.correctionCount, 1);
  assert.equal(summary[0]!.invoiceGrandTotal, 2090);
  assert.equal(summary[0]!.returnGrandTotal, 1100);
  assert.equal(summary[0]!.netBeforeCorrections, 990);
  assert.equal(summary[0]!.correctionGrandTotal, 1298);
});

test("matching status sums canonical decimal quantities exactly", () => {
  assert.deepEqual(calculatePurchaseMatchingStatus("2.5", ["1.1", "0.4"]), {
    invoiceBaseQuantity: "2.5",
    matchedBaseQuantity: "1.5",
    remainingBaseQuantity: "1",
    status: "partially-matched",
  });
  assert.equal(calculatePurchaseMatchingStatus("2.5", ["2.5"]).status, "fully-matched");
  assert.equal(calculatePurchaseMatchingStatus("2.5", []).status, "unmatched");
  assert.throws(() => calculatePurchaseMatchingStatus("2.5", ["2.6"]), /overmatched/u);
});
