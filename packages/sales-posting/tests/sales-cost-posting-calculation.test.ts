import assert from "node:assert/strict";
import test from "node:test";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  calculateSalesCostPosting,
} from "../src/index.ts";

function valuation() {
  return {
    sourceDocumentId: "sales-invoice-001",
    companyId: "company-001",
    ready: true,
    lines: [{
      salesLineId: "stock-1",
      productId: "product-001",
      movementId: "movement-001",
      valuationEntryId: "valuation-001",
      method: "fifo",
      strategyVersion: 3,
      currency: "IRR",
      quantity: "2",
      unitCost: "600000",
      totalCost: -1_200_000,
      valuedAt: "2026-10-06T12:14:00.000Z",
      revision: 2,
    }],
  } as const;
}

function cogs() {
  return [{
    lineId: "stock-1",
    resolution: {
      ruleId: "cogs-rule",
      accountRole: "cogs",
      salesLineId: "stock-1",
      productId: "product-001",
      valuationEntryId: "valuation-001",
      account: {
        accountId: "account-cogs",
        companyId: "company-001",
        code: "5101",
        name: "COGS",
        status: "active",
        postingAllowed: true,
      },
    },
  }] as const;
}

function inventory() {
  return [{
    lineId: "stock-1",
    resolution: {
      ruleId: "inventory-rule",
      accountRole: "inventory-asset",
      salesLineId: "stock-1",
      productId: "product-001",
      movementId: "movement-001",
      valuationEntryId: "valuation-001",
      warehouseId: "warehouse-001",
      account: {
        accountId: "account-inventory",
        companyId: "company-001",
        code: "1301",
        name: "Inventory",
        status: "active",
        postingAllowed: true,
      },
    },
  }] as const;
}

test("creates balanced COGS debit and Inventory credit from resolved valuation", () => {
  const result = calculateSalesCostPosting({
    valuation: valuation(),
    cogsByLine: cogs(),
    inventoryByLine: inventory(),
  });

  assert.equal(result.currency, "IRR");
  assert.equal(result.totalDebit, 1_200_000);
  assert.equal(result.totalCredit, 1_200_000);
  assert.equal(result.balanced, true);
  assert.deepEqual(
    result.components.map((component) => ({
      role: component.role,
      side: component.side,
      accountId: component.accountId,
      amount: component.amount,
    })),
    [
      {
        role: "cogs",
        side: "debit",
        accountId: "account-cogs",
        amount: 1_200_000,
      },
      {
        role: "inventory-asset",
        side: "credit",
        accountId: "account-inventory",
        amount: 1_200_000,
      },
    ],
  );
});

test("supports Moving Average with the same accounting direction", () => {
  const result = calculateSalesCostPosting({
    valuation: {
      ...valuation(),
      lines: [{
        ...valuation().lines[0],
        method: "moving_average",
        totalCost: -900_000,
        valuationEntryId: "valuation-mwa",
      }],
    },
    cogsByLine: [{
      ...cogs()[0],
      resolution: {
        ...cogs()[0].resolution,
        valuationEntryId: "valuation-mwa",
      },
    }],
    inventoryByLine: [{
      ...inventory()[0],
      resolution: {
        ...inventory()[0].resolution,
        valuationEntryId: "valuation-mwa",
      },
    }],
  });

  assert.equal(result.totalDebit, 900_000);
  assert.equal(result.totalCredit, 900_000);
  assert.equal(result.components[0]!.valuationMethod, "moving_average");
});

test("zero resolved cost creates no synthetic accounting components", () => {
  const result = calculateSalesCostPosting({
    valuation: {
      ...valuation(),
      lines: [{
        ...valuation().lines[0],
        totalCost: 0,
        unitCost: "0",
      }],
    },
    cogsByLine: cogs(),
    inventoryByLine: inventory(),
  });

  assert.equal(result.totalDebit, 0);
  assert.equal(result.totalCredit, 0);
  assert.deepEqual(result.components, []);
});

test("service-only/no-stock valuation produces an empty balanced cost leg", () => {
  const result = calculateSalesCostPosting({
    valuation: {
      sourceDocumentId: "service-invoice",
      companyId: "company-001",
      ready: true,
      lines: [],
    },
    cogsByLine: [],
    inventoryByLine: [],
  });

  assert.equal(result.currency, null);
  assert.equal(result.totalDebit, 0);
  assert.equal(result.totalCredit, 0);
  assert.deepEqual(result.components, []);
});

test("rejects missing, duplicate or extra account resolutions", () => {
  assert.throws(
    () => calculateSalesCostPosting({
      valuation: valuation(),
      cogsByLine: [],
      inventoryByLine: inventory(),
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
  );

  assert.throws(
    () => calculateSalesCostPosting({
      valuation: valuation(),
      cogsByLine: [cogs()[0], cogs()[0]],
      inventoryByLine: inventory(),
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
  );

  assert.throws(
    () => calculateSalesCostPosting({
      valuation: valuation(),
      cogsByLine: [
        ...cogs(),
        { ...cogs()[0], lineId: "unknown-line" },
      ],
      inventoryByLine: inventory(),
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
  );
});

test("rejects valuation/account provenance mismatch", () => {
  assert.throws(
    () => calculateSalesCostPosting({
      valuation: valuation(),
      cogsByLine: [{
        ...cogs()[0],
        resolution: {
          ...cogs()[0].resolution,
          valuationEntryId: "valuation-x",
        },
      }],
      inventoryByLine: inventory(),
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
  );

  assert.throws(
    () => calculateSalesCostPosting({
      valuation: valuation(),
      cogsByLine: cogs(),
      inventoryByLine: [{
        ...inventory()[0],
        resolution: {
          ...inventory()[0].resolution,
          movementId: "movement-x",
        },
      }],
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
  );
});

test("rejects cross-company accounts and positive outbound cost", () => {
  assert.throws(
    () => calculateSalesCostPosting({
      valuation: valuation(),
      cogsByLine: [{
        ...cogs()[0],
        resolution: {
          ...cogs()[0].resolution,
          account: {
            ...cogs()[0].resolution.account,
            companyId: "company-x",
          },
        },
      }],
      inventoryByLine: inventory(),
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
  );

  assert.throws(
    () => calculateSalesCostPosting({
      valuation: {
        ...valuation(),
        lines: [{
          ...valuation().lines[0],
          totalCost: 1_200_000,
        }],
      },
      cogsByLine: cogs(),
      inventoryByLine: inventory(),
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.costPostingInvalid,
  );
});

test("rejects mixed valuation currencies because one cost leg cannot sum them safely", () => {
  assert.throws(
    () => calculateSalesCostPosting({
      valuation: {
        ...valuation(),
        lines: [
          valuation().lines[0],
          {
            ...valuation().lines[0],
            salesLineId: "stock-2",
            productId: "product-002",
            movementId: "movement-002",
            valuationEntryId: "valuation-002",
            currency: "USD",
          },
        ],
      },
      cogsByLine: [
        ...cogs(),
        {
          lineId: "stock-2",
          resolution: {
            ...cogs()[0].resolution,
            salesLineId: "stock-2",
            productId: "product-002",
            valuationEntryId: "valuation-002",
          },
        },
      ],
      inventoryByLine: [
        ...inventory(),
        {
          lineId: "stock-2",
          resolution: {
            ...inventory()[0].resolution,
            salesLineId: "stock-2",
            productId: "product-002",
            movementId: "movement-002",
            valuationEntryId: "valuation-002",
          },
        },
      ],
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.costPostingInvalid
      && error.field === "valuation.currency",
  );
});

test("preserves valuation provenance and does not create Journal lines", () => {
  const result = calculateSalesCostPosting({
    valuation: valuation(),
    cogsByLine: cogs(),
    inventoryByLine: inventory(),
  });

  const cogsComponent = result.components[0]!;
  assert.equal(cogsComponent.salesLineId, "stock-1");
  assert.equal(cogsComponent.productId, "product-001");
  assert.equal(cogsComponent.movementId, "movement-001");
  assert.equal(cogsComponent.valuationEntryId, "valuation-001");
  assert.equal(cogsComponent.valuationRevision, 2);
  assert.equal("journalLineId" in cogsComponent, false);
  assert.equal("journalVoucherId" in cogsComponent, false);
});
