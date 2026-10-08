import assert from "node:assert/strict";
import test from "node:test";

import {
  createSalesInvoice,
} from "@argin/sales";

import {
  SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
  SALES_OUTPUT_VAT_ACCOUNT_ROLE,
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SALES_REVENUE_ACCOUNT_ROLE,
  SalesPostingDomainError,
  calculateSalesCommercialPosting,
  createSalesCommercialPostingInput,
  createSalesPostingSourceIdentity,
} from "../src/index.ts";

function assertDomainError(
  action: () => unknown,
  code: string,
  field: string,
): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof SalesPostingDomainError);
    assert.equal(error.code, code);
    assert.equal(error.field, field);
    return true;
  });
}

function sourceInvoice() {
  return createSalesInvoice({
    documentId: "sales-invoice-001",
    companyId: "company-001",
    branchId: "branch-001",
    fiscalYearId: "fy-1405",
    customer: {
      partyId: "customer-001",
      code: "C-001",
      displayName: "Customer 001",
    },
    businessDate: "2026-10-06",
    capturedAt: "2026-10-06T12:00:00.000Z",
    lines: [
      {
        lineId: "line-stock",
        position: 1,
        lineKind: "stock-product",
        productId: "product-001",
        commercialTerms: {
          quantity: 2,
          currency: "IRR",
          unitPrice: 1_000_000,
          priceOrigin: "manual",
        },
      },
      {
        lineId: "line-service",
        position: 2,
        lineKind: "service",
        productId: "service-001",
        commercialTerms: {
          quantity: 1,
          currency: "IRR",
          unitPrice: 500_000,
          priceOrigin: "manual",
          taxes: [
            {
              taxId: "vat-10",
              taxCode: "VAT",
              rateBasisPoints: 1000,
            },
          ],
        },
      },
    ],
  });
}

function commercialInput() {
  const invoice = sourceInvoice();
  return createSalesCommercialPostingInput({
    source: createSalesPostingSourceIdentity({
      sourceType: "sales-invoice",
      sourceDocumentId: invoice.document.documentId,
      sourceVersion: 3,
    }),
    document: invoice.document,
    commercialSnapshots: invoice.commercialSnapshots,
    documentTotals: invoice.totals,
  });
}

function arResolution() {
  return {
    ruleId: "ar-rule",
    accountRole: SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
    customerPartyId: "customer-001",
    account: {
      accountId: "account-ar",
      companyId: "company-001",
      code: "1201",
      name: "Accounts Receivable",
      status: "active",
      postingAllowed: true,
    },
  } as const;
}

function revenueResolutions() {
  return [
    {
      lineId: "line-stock",
      resolution: {
        ruleId: "revenue-stock",
        accountRole: SALES_REVENUE_ACCOUNT_ROLE,
        lineKind: "stock-product",
        account: {
          accountId: "account-sales-goods",
          companyId: "company-001",
          code: "4101",
          name: "Sales Revenue - Goods",
          status: "active",
          postingAllowed: true,
        },
      },
    },
    {
      lineId: "line-service",
      resolution: {
        ruleId: "revenue-service",
        accountRole: SALES_REVENUE_ACCOUNT_ROLE,
        lineKind: "service",
        account: {
          accountId: "account-sales-service",
          companyId: "company-001",
          code: "4102",
          name: "Service Revenue",
          status: "active",
          postingAllowed: true,
        },
      },
    },
  ] as const;
}

function vatResolutions() {
  return [
    {
      lineId: "line-service",
      resolution: {
        ruleId: "vat-standard",
        accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
        taxId: "vat-10",
        taxCode: "VAT",
        rateBasisPoints: 1000,
        account: {
          accountId: "account-output-vat",
          companyId: "company-001",
          code: "2402",
          name: "Output VAT",
          status: "active",
          postingAllowed: true,
        },
      },
    },
  ] as const;
}

test("creates balanced AR debit, Revenue credit and Output VAT credit", () => {
  const posting = calculateSalesCommercialPosting({
    commercial: commercialInput(),
    accountsReceivable: arResolution(),
    revenueByLine: revenueResolutions(),
    outputVatByLine: vatResolutions(),
  });

  assert.equal(posting.balanced, true);
  assert.equal(posting.totalDebit, 2_550_000);
  assert.equal(posting.totalCredit, 2_550_000);

  const ar = posting.components.find((component) => component.role === "accounts-receivable");
  assert.ok(ar);
  assert.equal(ar.side, "debit");
  assert.equal(ar.amount, 2_550_000);
  assert.equal(ar.customerPartyId, "customer-001");

  const revenues = posting.components.filter((component) => component.role === "sales-revenue");
  assert.equal(revenues.length, 2);
  assert.equal(revenues.reduce((sum, component) => sum + component.amount, 0), 2_500_000);

  const vat = posting.components.find((component) => component.role === "output-vat");
  assert.ok(vat);
  assert.equal(vat.side, "credit");
  assert.equal(vat.amount, 50_000);
  assert.deepEqual(vat.taxIds, ["vat-10"]);
});

test("creates no VAT component for zero-tax lines", () => {
  const invoice = createSalesInvoice({
    documentId: "sales-invoice-zero-tax",
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
    lines: [
      {
        lineId: "line-1",
        position: 1,
        lineKind: "service",
        productId: "service-001",
        commercialTerms: {
          quantity: 1,
          currency: "IRR",
          unitPrice: 100_000,
          priceOrigin: "manual",
        },
      },
    ],
  });
  const commercial = createSalesCommercialPostingInput({
    source: createSalesPostingSourceIdentity({
      sourceType: "sales-invoice",
      sourceDocumentId: invoice.document.documentId,
      sourceVersion: 1,
    }),
    document: invoice.document,
    commercialSnapshots: invoice.commercialSnapshots,
    documentTotals: invoice.totals,
  });

  const posting = calculateSalesCommercialPosting({
    commercial,
    accountsReceivable: arResolution(),
    revenueByLine: [{
      lineId: "line-1",
      resolution: {
        ruleId: "rev",
        accountRole: SALES_REVENUE_ACCOUNT_ROLE,
        lineKind: "service",
        account: {
          accountId: "revenue",
          companyId: "company-001",
          code: "4102",
          name: "Revenue",
          status: "active",
          postingAllowed: true,
        },
      },
    }],
    outputVatByLine: [],
  });

  assert.equal(posting.components.some((component) => component.role === "output-vat"), false);
  assert.equal(posting.totalDebit, 100_000);
  assert.equal(posting.totalCredit, 100_000);
});


test("zero-rate tax definition creates no Output VAT resolution/component", () => {
  const invoice = createSalesInvoice({
    documentId: "sales-invoice-zero-rate-tax",
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
    lines: [
      {
        lineId: "line-1",
        position: 1,
        lineKind: "service",
        productId: "service-001",
        commercialTerms: {
          quantity: 1,
          currency: "IRR",
          unitPrice: 100_000,
          priceOrigin: "manual",
          taxes: [{
            taxId: "vat-zero",
            taxCode: "VAT",
            rateBasisPoints: 0,
          }],
        },
      },
    ],
  });
  const commercial = createSalesCommercialPostingInput({
    source: createSalesPostingSourceIdentity({
      sourceType: "sales-invoice",
      sourceDocumentId: invoice.document.documentId,
      sourceVersion: 1,
    }),
    document: invoice.document,
    commercialSnapshots: invoice.commercialSnapshots,
    documentTotals: invoice.totals,
  });

  assert.equal(commercial.lines[0]?.terms.taxes.length, 1);
  assert.equal(commercial.lines[0]?.totals.taxAmount, 0);

  const posting = calculateSalesCommercialPosting({
    commercial,
    accountsReceivable: arResolution(),
    revenueByLine: [{
      lineId: "line-1",
      resolution: {
        ruleId: "rev",
        accountRole: SALES_REVENUE_ACCOUNT_ROLE,
        lineKind: "service",
        account: {
          accountId: "revenue",
          companyId: "company-001",
          code: "4102",
          name: "Revenue",
          status: "active",
          postingAllowed: true,
        },
      },
    }],
    outputVatByLine: [],
  });

  assert.equal(
    posting.components.some((component) => component.role === "output-vat"),
    false,
  );
  assert.equal(posting.totalDebit, 100_000);
  assert.equal(posting.totalCredit, 100_000);
});

test("rejects AR resolution for another customer or company", () => {
  assertDomainError(
    () => calculateSalesCommercialPosting({
      commercial: commercialInput(),
      accountsReceivable: {
        ...arResolution(),
        customerPartyId: "customer-999",
      },
      revenueByLine: revenueResolutions(),
      outputVatByLine: vatResolutions(),
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
    "accountsReceivable",
  );
});

test("rejects missing or line-kind-mismatched Revenue resolution", () => {
  assertDomainError(
    () => calculateSalesCommercialPosting({
      commercial: commercialInput(),
      accountsReceivable: arResolution(),
      revenueByLine: revenueResolutions().slice(0, 1),
      outputVatByLine: vatResolutions(),
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
    "revenueByLine",
  );

  const wrong = revenueResolutions().map((entry) =>
    entry.lineId === "line-service"
      ? {
          ...entry,
          resolution: {
            ...entry.resolution,
            lineKind: "stock-product" as const,
          },
        }
      : entry,
  );

  assertDomainError(
    () => calculateSalesCommercialPosting({
      commercial: commercialInput(),
      accountsReceivable: arResolution(),
      revenueByLine: wrong,
      outputVatByLine: vatResolutions(),
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
    "revenueByLine.resolution",
  );
});

test("rejects missing, duplicate or mismatched VAT resolutions", () => {
  assertDomainError(
    () => calculateSalesCommercialPosting({
      commercial: commercialInput(),
      accountsReceivable: arResolution(),
      revenueByLine: revenueResolutions(),
      outputVatByLine: [],
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
    "outputVatByLine",
  );

  const duplicate = [...vatResolutions(), ...vatResolutions()];
  assertDomainError(
    () => calculateSalesCommercialPosting({
      commercial: commercialInput(),
      accountsReceivable: arResolution(),
      revenueByLine: revenueResolutions(),
      outputVatByLine: duplicate,
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
    "outputVatByLine",
  );

  const wrongTax = [{
    ...vatResolutions()[0],
    resolution: {
      ...vatResolutions()[0]!.resolution,
      taxId: "other-tax",
    },
  }];
  assertDomainError(
    () => calculateSalesCommercialPosting({
      commercial: commercialInput(),
      accountsReceivable: arResolution(),
      revenueByLine: revenueResolutions(),
      outputVatByLine: wrongTax,
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
    "outputVatByLine.tax",
  );
});

test("preserves multiple tax facts only when they resolve to one VAT account", () => {
  const invoice = createSalesInvoice({
    documentId: "sales-invoice-multi-tax",
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
    lines: [
      {
        lineId: "line-1",
        position: 1,
        lineKind: "service",
        productId: "service-001",
        commercialTerms: {
          quantity: 1,
          currency: "IRR",
          unitPrice: 1_000_000,
          priceOrigin: "manual",
          taxes: [
            { taxId: "tax-a", taxCode: "VAT-A", rateBasisPoints: 500 },
            { taxId: "tax-b", taxCode: "VAT-B", rateBasisPoints: 500 },
          ],
        },
      },
    ],
  });
  const commercial = createSalesCommercialPostingInput({
    source: createSalesPostingSourceIdentity({
      sourceType: "sales-invoice",
      sourceDocumentId: invoice.document.documentId,
      sourceVersion: 1,
    }),
    document: invoice.document,
    commercialSnapshots: invoice.commercialSnapshots,
    documentTotals: invoice.totals,
  });

  const base = {
    ruleId: "vat",
    accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
    account: {
      accountId: "vat-account",
      companyId: "company-001",
      code: "2402",
      name: "Output VAT",
      status: "active",
      postingAllowed: true,
    },
  } as const;

  const posting = calculateSalesCommercialPosting({
    commercial,
    accountsReceivable: arResolution(),
    revenueByLine: [{
      lineId: "line-1",
      resolution: {
        ruleId: "rev",
        accountRole: SALES_REVENUE_ACCOUNT_ROLE,
        lineKind: "service",
        account: {
          accountId: "revenue",
          companyId: "company-001",
          code: "4102",
          name: "Revenue",
          status: "active",
          postingAllowed: true,
        },
      },
    }],
    outputVatByLine: [
      {
        lineId: "line-1",
        resolution: {
          ...base,
          taxId: "tax-a",
          taxCode: "VAT-A",
          rateBasisPoints: 500,
        },
      },
      {
        lineId: "line-1",
        resolution: {
          ...base,
          taxId: "tax-b",
          taxCode: "VAT-B",
          rateBasisPoints: 500,
        },
      },
    ],
  });

  const vat = posting.components.find((component) => component.role === "output-vat");
  assert.ok(vat);
  assert.deepEqual(vat.taxIds, ["tax-a", "tax-b"]);
  assert.equal(vat.amount, 100_000);

  assertDomainError(
    () => calculateSalesCommercialPosting({
      commercial,
      accountsReceivable: arResolution(),
      revenueByLine: [{
        lineId: "line-1",
        resolution: {
          ruleId: "rev",
          accountRole: SALES_REVENUE_ACCOUNT_ROLE,
          lineKind: "service",
          account: {
            accountId: "revenue",
            companyId: "company-001",
            code: "4102",
            name: "Revenue",
            status: "active",
            postingAllowed: true,
          },
        },
      }],
      outputVatByLine: [
        {
          lineId: "line-1",
          resolution: {
            ...base,
            taxId: "tax-a",
            taxCode: "VAT-A",
            rateBasisPoints: 500,
          },
        },
        {
          lineId: "line-1",
          resolution: {
            ...base,
            taxId: "tax-b",
            taxCode: "VAT-B",
            rateBasisPoints: 500,
            account: {
              ...base.account,
              accountId: "another-vat-account",
            },
          },
        },
      ],
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
    "outputVatByLine.account",
  );
});

test("does not introduce COGS or Inventory components in commercial calculation", () => {
  const posting = calculateSalesCommercialPosting({
    commercial: commercialInput(),
    accountsReceivable: arResolution(),
    revenueByLine: revenueResolutions(),
    outputVatByLine: vatResolutions(),
  });

  assert.equal(posting.components.some((component) =>
    component.role === ("cogs" as never)
    || component.role === ("inventory" as never)
  ), false);
});
