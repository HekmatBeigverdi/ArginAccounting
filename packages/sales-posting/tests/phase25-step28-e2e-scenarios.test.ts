import assert from "node:assert/strict";
import test from "node:test";

import {
  createSalesCorrectionReplacementPlan,
  createSalesPostingJournalDraft,
  orchestrateMixedSalesInvoicePosting,
  orchestrateSalesPostFinalization,
  orchestrateServiceOnlySalesInvoicePosting,
  reverseSalesReturnCommercialPosting,
  salesJournalComponentsFromInvoice,
  salesJournalComponentsFromReturn,
} from "../src/index.ts";

const source = {
  sourceSystem: "sales",
  sourceType: "sales-invoice",
  sourceDocumentId: "inv-e2e-001",
  sourceVersion: 3,
  externalReference: null,
} as const;

function commercialInput(kind: "service" | "stock" | "mixed", taxAmount = 100) {
  const zeroTotals = {
    currency: "IRR",
    grossAmount: 0,
    discountAmount: 0,
    netAfterDiscount: 0,
    chargeAmount: 0,
    taxBaseAmount: 0,
    taxAmount: 0,
    grandTotal: 0,
  };

  const lines:any[] = [];
  if (kind !== "service") {
    lines.push({
      snapshotId: "snap-stock",
      lineId: "stock-1",
      productId: "product-1",
      lineKind: "stock-product",
      capturedAt: "2026-10-07T10:00:00.000Z",
      terms: { taxes: taxAmount > 0 ? [{ taxId: "vat", taxCode: "VAT", rateBasisPoints: 1000 }] : [] },
      totals: {
        ...zeroTotals,
        grossAmount: 1000,
        netAfterDiscount: 1000,
        taxBaseAmount: 1000,
        taxAmount,
        grandTotal: 1000 + taxAmount,
      },
    });
  }
  if (kind !== "stock") {
    lines.push({
      snapshotId: "snap-service",
      lineId: "service-1",
      productId: "service-1",
      lineKind: "service",
      capturedAt: "2026-10-07T10:00:00.000Z",
      terms: { taxes: [] },
      totals: {
        ...zeroTotals,
        grossAmount: 500,
        netAfterDiscount: 500,
        taxBaseAmount: 500,
        grandTotal: 500,
      },
    });
  }

  const grandTotal = lines.reduce((sum, line) => sum + line.totals.grandTotal, 0);
  const taxBaseAmount = lines.reduce((sum, line) => sum + line.totals.taxBaseAmount, 0);
  const totalTax = lines.reduce((sum, line) => sum + line.totals.taxAmount, 0);

  return {
    source,
    companyId: "company-1",
    branchId: "branch-1",
    fiscalYearId: "fy-1",
    customerPartyId: "customer-1",
    businessDate: "2026-10-07",
    currency: "IRR",
    documentTotals: {
      currency: "IRR",
      lineCount: lines.length,
      grossAmount: taxBaseAmount,
      discountAmount: 0,
      netAfterDiscount: taxBaseAmount,
      chargeAmount: 0,
      taxBaseAmount,
      taxAmount: totalTax,
      grandTotal,
    },
    lines,
  } as any;
}

function commercialPosting(input: any) {
  const components:any[] = [{
    componentId: "commercial:ar",
    role: "accounts-receivable",
    side: "debit",
    accountId: "ar",
    amount: input.documentTotals.grandTotal,
    currency: "IRR",
    sourceLineId: null,
    customerPartyId: input.customerPartyId,
    taxIds: [],
    taxCodes: [],
  }];

  for (const line of input.lines) {
    if (line.totals.taxBaseAmount > 0) {
      components.push({
        componentId: `commercial:revenue:${line.lineId}`,
        role: "sales-revenue",
        side: "credit",
        accountId: line.lineKind === "service" ? "service-revenue" : "sales-revenue",
        amount: line.totals.taxBaseAmount,
        currency: "IRR",
        sourceLineId: line.lineId,
        customerPartyId: null,
        taxIds: [],
        taxCodes: [],
      });
    }
    if (line.totals.taxAmount > 0) {
      components.push({
        componentId: `commercial:vat:${line.lineId}`,
        role: "output-vat",
        side: "credit",
        accountId: "output-vat",
        amount: line.totals.taxAmount,
        currency: "IRR",
        sourceLineId: line.lineId,
        customerPartyId: null,
        taxIds: ["vat"],
        taxCodes: ["VAT"],
      });
    }
  }

  return {
    currency: "IRR",
    totalDebit: input.documentTotals.grandTotal,
    totalCredit: input.documentTotals.grandTotal,
    balanced: true,
    components,
  } as any;
}

function costPosting(amount = 600) {
  return {
    currency: "IRR",
    totalDebit: amount,
    totalCredit: amount,
    balanced: true,
    components: [
      {
        componentId: "cost:cogs:stock-1",
        role: "cogs",
        side: "debit",
        accountId: "cogs",
        amount,
        currency: "IRR",
        salesLineId: "stock-1",
        productId: "product-1",
        movementId: "movement-1",
        valuationEntryId: "valuation-1",
        valuationMethod: "fifo",
        valuationRevision: 2,
      },
      {
        componentId: "cost:inventory:stock-1",
        role: "inventory-asset",
        side: "credit",
        accountId: "inventory",
        amount,
        currency: "IRR",
        salesLineId: "stock-1",
        productId: "product-1",
        movementId: "movement-1",
        valuationEntryId: "valuation-1",
        valuationMethod: "fifo",
        valuationRevision: 2,
      },
    ],
  } as any;
}

function journal(components:readonly any[], id:string) {
  return createSalesPostingJournalDraft({
    journalVoucherId: id,
    journalNumber: id.toUpperCase(),
    postingId: `posting:${id}`,
    source,
    companyId: "company-1",
    branchId: "branch-1",
    voucherDate: "2026-10-07",
    fiscalYearId: "fy-1",
    fiscalPeriodId: "fp-1",
    createdAtUtc: "2026-10-07T12:00:00.000Z",
    components,
    requestId: `request:${id}`,
    causationId: null,
  });
}

test("E2E stock invoice waits for inventory, then becomes one balanced commercial+COGS Journal", () => {
  const commercial = commercialInput("stock");
  const sales = commercialPosting(commercial);

  const pending = orchestrateSalesPostFinalization({
    commercialInput: commercial,
    commercialPosting: sales,
  });
  assert.equal(pending.status, "pending");
  if (pending.status === "pending") assert.equal(pending.reason, "waiting-for-issue");

  const ready = orchestrateSalesPostFinalization({
    commercialInput: commercial,
    commercialPosting: sales,
    stockFulfillment: {
      sourceDocumentId: source.sourceDocumentId,
      companyId: "company-1",
      hasStockLines: true,
      cogsEligible: true,
      lines: [{
        salesLineId: "stock-1",
        productId: "product-1",
        lineKind: "stock-product",
        status: "eligible",
        inventoryDocumentId: "issue-1",
        inventoryLineId: "issue-line-1",
        inventoryDocumentStatus: "confirmed",
      }],
    } as any,
    issueLineage: {sourceDocumentId:source.sourceDocumentId,companyId:"company-1",lines:[{salesLineId:"stock-1"}]} as any,
    movementLineage: {sourceDocumentId:source.sourceDocumentId,companyId:"company-1",lines:[{salesLineId:"stock-1"}]} as any,
    valuation: {sourceDocumentId:source.sourceDocumentId,companyId:"company-1",ready:true,lines:[{salesLineId:"stock-1"}]} as any,
    costPosting: costPosting(),
  });

  assert.equal(ready.status, "ready");
  const draft = journal(
    salesJournalComponentsFromInvoice({ commercial: sales, cost: costPosting() }),
    "journal-stock",
  );

  assert.equal(draft.journal.totalDebit.amount, 1700);
  assert.equal(draft.journal.totalCredit.amount, 1700);
  assert.equal(draft.journal.lines.length, 5);
  assert.equal(draft.provenance.lineProvenance.filter(x => x.valuationEntryId === "valuation-1").length, 2);
});

test("E2E service-only invoice posts immediately with no Inventory/COGS lines", () => {
  const commercial = commercialInput("service", 0);
  const sales = commercialPosting(commercial);
  const result = orchestrateServiceOnlySalesInvoicePosting({
    commercialInput: commercial,
    commercialPosting: sales,
  });

  assert.equal(result.inventoryRequired, false);
  assert.equal(result.costPostingRequired, false);

  const draft = journal(
    salesJournalComponentsFromInvoice({ commercial: sales, cost: null }),
    "journal-service",
  );
  assert.equal(draft.journal.lines.some(line => line.accountId === "cogs"), false);
  assert.equal(draft.journal.lines.some(line => line.accountId === "inventory"), false);
  assert.equal(draft.journal.totalDebit.amount, 500);
  assert.equal(draft.journal.totalCredit.amount, 500);
});

test("E2E mixed invoice applies commercial posting to all lines but cost only to stock line", () => {
  const commercial = commercialInput("mixed");
  const sales = commercialPosting(commercial);
  const cost = costPosting();
  const result = orchestrateMixedSalesInvoicePosting({
    commercialInput: commercial,
    commercialPosting: sales,
    costPosting: cost,
  });

  assert.deepEqual(result.stockLineIds, ["stock-1"]);
  assert.deepEqual(result.nonStockLineIds, ["service-1"]);
  assert.equal(result.costComponents.every(x => x.salesLineId === "stock-1"), true);

  const draft = journal(
    salesJournalComponentsFromInvoice({ commercial: sales, cost }),
    "journal-mixed",
  );
  assert.equal(draft.journal.totalDebit.amount, 2200);
  assert.equal(draft.journal.totalCredit.amount, 2200);
});

test("E2E zero VAT produces no Output VAT Journal line", () => {
  const commercial = commercialInput("stock", 0);
  const sales = commercialPosting(commercial);
  const draft = journal(
    salesJournalComponentsFromInvoice({ commercial: sales, cost: costPosting() }),
    "journal-zero-vat",
  );

  assert.equal(sales.components.some((x:any) => x.role === "output-vat"), false);
  assert.equal(draft.provenance.lineProvenance.some(x => x.role === "output-vat"), false);
  assert.equal(draft.journal.totalDebit.amount, 1600);
  assert.equal(draft.journal.totalCredit.amount, 1600);
});

test("E2E sales return reverses commercial effect and restores Inventory/COGS", () => {
  const returnCommercial = {
    ...commercialInput("stock"),
    source: {
      ...source,
      sourceType: "sales-return",
      sourceDocumentId: "return-1",
      sourceVersion: 1,
    },
  } as any;
  const forward = commercialPosting(returnCommercial);
  const lineage = {
    returnDocumentId: "return-1",
    originalInvoiceId: "inv-original",
    lines: [{
      returnLineId: "stock-1",
      originalInvoiceLineId: "original-line-1",
      productId: "product-1",
    }],
  };
  const reversed = reverseSalesReturnCommercialPosting({
    commercialInput: returnCommercial,
    commercialPosting: forward,
    lineage,
  });
  const restoredCost = {
    sourceDocumentId: "return-1",
    originalInvoiceId: "inv-original",
    companyId: "company-1",
    currency: "IRR",
    totalDebit: 600,
    totalCredit: 600,
    balanced: true,
    lines: [],
    components: [
      {
        componentId: "return-cost:inventory:stock-1",
        role: "inventory-asset",
        side: "debit",
        accountId: "inventory",
        amount: 600,
        currency: "IRR",
        returnLineId: "stock-1",
        originalInvoiceLineId: "original-line-1",
        productId: "product-1",
        inventoryDocumentId: "receipt-1",
        inventoryLineId: "receipt-line-1",
        movementId: "return-movement-1",
        valuationEntryId: "return-valuation-1",
        valuationMethod: "fifo",
        valuationRevision: 3,
      },
      {
        componentId: "return-cost:cogs:stock-1",
        role: "cogs",
        side: "credit",
        accountId: "cogs",
        amount: 600,
        currency: "IRR",
        returnLineId: "stock-1",
        originalInvoiceLineId: "original-line-1",
        productId: "product-1",
        inventoryDocumentId: "receipt-1",
        inventoryLineId: "receipt-line-1",
        movementId: "return-movement-1",
        valuationEntryId: "return-valuation-1",
        valuationMethod: "fifo",
        valuationRevision: 3,
      },
    ],
  } as any;

  const components = salesJournalComponentsFromReturn({
    commercial: reversed,
    cost: restoredCost,
  });
  const returnJournal = createSalesPostingJournalDraft({
    ...journal(components, "temporary").journal,
  } as any);

  void returnJournal;
  assert.equal(reversed.components.find(x => x.role === "accounts-receivable")?.side, "credit");
  assert.equal(reversed.components.find(x => x.role === "sales-revenue")?.side, "debit");
  assert.equal(restoredCost.components.find((x:any) => x.role === "inventory-asset")?.side, "debit");
  assert.equal(restoredCost.components.find((x:any) => x.role === "cogs")?.side, "credit");

  const draft = journal(components, "journal-return");
  assert.equal(draft.journal.totalDebit.amount, 1700);
  assert.equal(draft.journal.totalCredit.amount, 1700);
  assert.equal(draft.provenance.lineProvenance.every(x => x.originalInvoiceId === "inv-original"), true);
});

test("E2E correction remains explicit reverse-and-replace lineage", () => {
  const plan = createSalesCorrectionReplacementPlan({
    lineage: {
      correctionDocumentId: "correction-1",
      originalInvoiceId: "inv-original",
      lines: [{
        correctionLineId: "correction-line-1",
        originalInvoiceLineId: "original-line-1",
        productId: "product-1",
        lineKind: "stock-product",
      }],
    },
    originalSource: {
      sourceSystem: "sales",
      sourceType: "sales-invoice",
      sourceDocumentId: "inv-original",
      sourceVersion: 5,
      externalReference: null,
    },
    replacementSource: {
      sourceSystem: "sales",
      sourceType: "sales-correction",
      sourceDocumentId: "correction-1",
      sourceVersion: 2,
      externalReference: null,
    },
  });

  assert.equal(plan.mode, "reverse-and-replace");
  assert.equal(plan.originalSource.sourceVersion, 5);
  assert.equal(plan.replacementSource.sourceVersion, 2);
  assert.notEqual(plan.originalSource.sourceDocumentId, plan.replacementSource.sourceDocumentId);
});
