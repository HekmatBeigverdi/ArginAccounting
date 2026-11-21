import assert from "node:assert/strict";
import test from "node:test";

import {
  SALES_COGS_ACCOUNT_ROLE,
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  createSalesCogsAccountRule,
  resolveSalesCogsAccount,
  selectSalesCogsAccountRule,
} from "../src/index.ts";

function context() {
  return {
    companyId: "company-001",
    branchId: "branch-001",
    salesLineId: "stock-1",
    productId: "product-001",
    valuationEntryId: "valuation-001",
    accountRole: SALES_COGS_ACCOUNT_ROLE,
  } as const;
}

function rules() {
  return [
    createSalesCogsAccountRule({
      ruleId: "cogs-default",
      companyId: "company-001",
      branchId: null,
      accountRole: SALES_COGS_ACCOUNT_ROLE,
      accountId: "account-cogs-default",
      priority: 100,
      active: true,
    }),
    createSalesCogsAccountRule({
      ruleId: "cogs-branch",
      companyId: "company-001",
      branchId: "branch-001",
      accountRole: SALES_COGS_ACCOUNT_ROLE,
      accountId: "account-cogs-branch",
      priority: 1,
      active: true,
    }),
  ];
}

test("branch-specific COGS rule outranks company default regardless of priority", () => {
  const selected = selectSalesCogsAccountRule(rules(), context());
  assert.equal(selected.ruleId, "cogs-branch");
});

test("company default COGS rule is used when no branch override exists", () => {
  const selected = selectSalesCogsAccountRule(
    rules(),
    { ...context(), branchId: "branch-002" },
  );
  assert.equal(selected.ruleId, "cogs-default");
});

test("priority breaks ties only between equally specific COGS rules", () => {
  const selected = selectSalesCogsAccountRule([
    createSalesCogsAccountRule({
      ruleId: "low",
      companyId: "company-001",
      branchId: null,
      accountRole: SALES_COGS_ACCOUNT_ROLE,
      accountId: "cogs-low",
      priority: 1,
      active: true,
    }),
    createSalesCogsAccountRule({
      ruleId: "high",
      companyId: "company-001",
      branchId: null,
      accountRole: SALES_COGS_ACCOUNT_ROLE,
      accountId: "cogs-high",
      priority: 10,
      active: true,
    }),
  ], { ...context(), branchId: "branch-009" });

  assert.equal(selected.ruleId, "high");
});

test("missing and ambiguous COGS mappings fail closed", () => {
  assert.throws(
    () => selectSalesCogsAccountRule([], context()),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.accountMappingMissing
      && error.field === "context.accountRole",
  );

  const ambiguous = [
    createSalesCogsAccountRule({
      ruleId: "a",
      companyId: "company-001",
      branchId: null,
      accountRole: SALES_COGS_ACCOUNT_ROLE,
      accountId: "account-a",
      priority: 5,
      active: true,
    }),
    createSalesCogsAccountRule({
      ruleId: "b",
      companyId: "company-001",
      branchId: null,
      accountRole: SALES_COGS_ACCOUNT_ROLE,
      accountId: "account-b",
      priority: 5,
      active: true,
    }),
  ];

  assert.throws(
    () => selectSalesCogsAccountRule(ambiguous, context()),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleAmbiguous,
  );
});

test("requires stock-line and valuation provenance in resolution context", () => {
  for (const [field, value] of [
    ["context.salesLineId", { ...context(), salesLineId: " " }],
    ["context.productId", { ...context(), productId: " " }],
    ["context.valuationEntryId", { ...context(), valuationEntryId: " " }],
  ] as const) {
    assert.throws(
      () => selectSalesCogsAccountRule(rules(), value),
      (error: unknown) =>
        error instanceof SalesPostingDomainError
        && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.identityRequired
        && error.field === field,
    );
  }
});

test("resolves active postable COGS account and preserves provenance", async () => {
  const result = await resolveSalesCogsAccount(
    rules(),
    context(),
    {
      async findById(companyId, accountId) {
        return {
          accountId,
          companyId,
          code: "5101",
          name: "Cost of Goods Sold",
          status: "active",
          postingAllowed: true,
        };
      },
    },
  );

  assert.equal(result.account.accountId, "account-cogs-branch");
  assert.equal(result.salesLineId, "stock-1");
  assert.equal(result.productId, "product-001");
  assert.equal(result.valuationEntryId, "valuation-001");
});

test("rejects missing, cross-company, inactive and non-postable COGS accounts", async () => {
  await assert.rejects(
    () => resolveSalesCogsAccount(rules(), context(), {
      async findById() { return null; },
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.accountMappingMissing,
  );

  await assert.rejects(
    () => resolveSalesCogsAccount(rules(), context(), {
      async findById(_companyId, accountId) {
        return {
          accountId,
          companyId: "company-999",
          code: "5101",
          name: "COGS",
          status: "active",
          postingAllowed: true,
        };
      },
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.accountInvalid,
  );

  await assert.rejects(
    () => resolveSalesCogsAccount(rules(), context(), {
      async findById(companyId, accountId) {
        return {
          accountId,
          companyId,
          code: "5101",
          name: "COGS",
          status: "inactive",
          postingAllowed: true,
        };
      },
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.accountNotPostable,
  );

  await assert.rejects(
    () => resolveSalesCogsAccount(rules(), context(), {
      async findById(companyId, accountId) {
        return {
          accountId,
          companyId,
          code: "5101",
          name: "COGS",
          status: "active",
          postingAllowed: false,
        };
      },
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.accountNotPostable,
  );
});

test("valuation method and valuation amount do not participate in COGS account selection", () => {
  const selected = selectSalesCogsAccountRule(rules(), context());
  assert.equal(selected.ruleId, "cogs-branch");
  assert.equal("method" in selected, false);
  assert.equal("totalCost" in selected, false);
  assert.equal("unitCost" in selected, false);
});
