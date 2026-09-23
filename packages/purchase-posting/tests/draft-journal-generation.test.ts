import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
  createPurchaseChargePostingPlan,
  createPurchasePostingDraftJournal,
  createPurchasePostingFact,
  createPurchasePostingRule,
  createPurchaseTaxPostingPlan,
  createSupplierInvoiceDraftComponents,
  createSupplierInvoicePostingPlan,
  resolveSupplierInvoiceInventoryValuation,
} from "../src/index.ts";

function amounts() {
  return {
    currency: "IRR",
    grossAmount: 9_000,
    discountAmount: 0,
    netAfterDiscount: 9_000,
    chargeAmount: 100,
    taxBaseAmount: 9_100,
    taxAmount: 910,
    grandTotal: 10_010,
  };
}

function invoice(valuationTotal = 9_100) {
  return createPurchasePostingFact({
    factId: "fact-invoice-001",
    companyId: "company-001",
    branchId: "branch-001",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "fp-07",
    purchaseDocumentId: "invoice-001",
    purchaseDocumentVersion: 1,
    documentType: "supplier-invoice",
    sourceStatus: "confirmed",
    documentNumber: "PINV-001",
    businessDate: "2026-09-23",
    supplier: {
      companyId: "company-001",
      supplierId: "supplier-001",
      code: "SUP-001",
      displayName: "Supplier",
      nationalCode: null,
      nationalId: null,
      economicNumber: null,
      taxFileNumber: null,
    },
    lines: [{
      purchaseLineId: "line-stock",
      position: 1,
      lineKind: "stock-product",
      item: {
        itemId: "product-001",
        itemType: "product",
        code: "P-001",
        displayName: "Product",
        taxpayerGoodsServiceId: null,
        stockTracking: true,
      },
      baseQuantity: "1",
      amounts: amounts(),
      valuations: [{
        companyId: "company-001",
        valuationEntryId: "valuation-001",
        movementId: "movement-001",
        inventoryDocumentId: "receipt-001",
        inventoryLineId: "receipt-line-001",
        productId: "product-001",
        warehouseId: "warehouse-001",
        policyId: "valuation-policy-001",
        method: "fifo",
        strategyVersion: 1,
        currency: "IRR",
        quantity: "1",
        unitCost: String(valuationTotal),
        totalCost: valuationTotal,
      }],
    }],
    totals: amounts(),
    capturedAt: "2026-09-23T06:00:00.000Z",
  });
}

const rules = [
  createPurchasePostingRule({
    ruleId: "inventory-rule",
    companyId: "company-001",
    branchId: null,
    eventKind: null,
    lineKind: "stock-product",
    accountRole: "inventory-asset",
    accountId: "acc-inventory",
    priority: 1,
    active: true,
  }),
  createPurchasePostingRule({
    ruleId: "vat-rule",
    companyId: "company-001",
    branchId: null,
    eventKind: null,
    lineKind: "stock-product",
    accountRole: "input-vat-recoverable",
    accountId: "acc-vat",
    priority: 1,
    active: true,
  }),
  createPurchasePostingRule({
    ruleId: "payable-rule",
    companyId: "company-001",
    branchId: null,
    eventKind: null,
    lineKind: null,
    accountRole: "accounts-payable",
    accountId: "acc-ap",
    priority: 1,
    active: true,
  }),
];


const dimensions = {
  async findPoliciesForAccount() {
    return [];
  },
  async findTypesByCompanyId() {
    return [];
  },
  async resolveMemberBySource() {
    return null;
  },
  async findMembersByIds() {
    return [];
  },
};

const accounts = {
  async findById(companyId: string, accountId: string) {
    return {
      accountId,
      companyId,
      code: accountId,
      name: accountId,
      status: "active" as const,
      postingAllowed: true,
    };
  },
};

function components(fact = invoice()) {
  const supplier = resolveSupplierInvoiceInventoryValuation(
    fact,
    createSupplierInvoicePostingPlan(fact),
  );
  const tax = createPurchaseTaxPostingPlan(fact, {
    policyId: "tax-policy-001",
    companyId: "company-001",
    recoverability: "recoverable",
  });
  const charge = createPurchaseChargePostingPlan(fact);
  return createSupplierInvoiceDraftComponents(supplier, tax, charge);
}

test("builds balanced Accounting draft journal from resolved Purchase components", async () => {
  const fact = invoice();
  const draft = await createPurchasePostingDraftJournal({
    fact,
    eventKind: "supplier-invoice-recognition",
    components: components(fact),
    rules,
    accounts,
    dimensions,
    trace: {
      requestId: "request-001",
      operationId: "operation-001",
      correlationId: "correlation-001",
      causationId: null,
    },
    journal: {
      voucherId: "voucher-001",
      voucherNumber: "JV-000001",
      lineIds: ["jline-1", "jline-2", "jline-3"],
      createdAt: "2026-09-23T06:30:00.000Z",
    },
  });

  assert.equal(draft.status, "draft");
  assert.equal(draft.branchId, "branch-001");
  assert.equal(draft.totalDebit.amount, 10_010);
  assert.equal(draft.totalCredit.amount, 10_010);
  assert.equal(draft.lines.length, 3);
  assert.equal(draft.source.type, "source_document");
  assert.equal(draft.source.sourceId, "invoice-001");
  assert.equal(draft.source.requestId, "request-001");
  assert.equal(draft.source.correlationId, "correlation-001");
});

test("does not double-post stock Purchase charge already included in valuation", () => {
  const list = components();
  assert.equal(list.some(item => item.accountRole === "purchase-charge"), false);
  assert.equal(list.find(item => item.accountRole === "inventory-asset")?.amount, 9_100);
});

test("fails before Accounting when authoritative valuation leaves draft unbalanced", async () => {
  const fact = invoice(9_000);
  await assert.rejects(
    () => createPurchasePostingDraftJournal({
      fact,
      eventKind: "supplier-invoice-recognition",
      components: components(fact),
      rules,
      accounts,
      dimensions,
      trace: {
        requestId: "request-001",
        operationId: "operation-001",
        correlationId: "correlation-001",
        causationId: null,
      },
      journal: {
        voucherId: "voucher-unbalanced",
        voucherNumber: "JV-000002",
        lineIds: ["jline-a", "jline-b", "jline-c"],
        createdAt: "2026-09-23T06:30:00.000Z",
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.draftJournalUnbalanced);
      return true;
    },
  );
});

test("requires one unique Journal Line id per effective component", async () => {
  const fact = invoice();
  await assert.rejects(
    () => createPurchasePostingDraftJournal({
      fact,
      eventKind: "supplier-invoice-recognition",
      components: components(fact),
      rules,
      accounts,
      dimensions,
      trace: {
        requestId: "request-001",
        operationId: "operation-001",
        correlationId: "correlation-001",
        causationId: null,
      },
      journal: {
        voucherId: "voucher-lines",
        voucherNumber: "JV-000003",
        lineIds: ["same", "same", "same"],
        createdAt: "2026-09-23T06:30:00.000Z",
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.draftJournalLineIdsInvalid);
      return true;
    },
  );
});
