import assert from "node:assert/strict";
import test from "node:test";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SALES_REVENUE_ACCOUNT_ROLE,
  SalesPostingDomainError,
  createSalesRevenueAccountRule,
  resolveSalesRevenueAccount,
  selectSalesRevenueAccountRule,
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

function rules() {
  return [
    createSalesRevenueAccountRule({
      ruleId: "default-revenue",
      companyId: "company-001",
      branchId: null,
      lineKind: null,
      accountRole: SALES_REVENUE_ACCOUNT_ROLE,
      accountId: "account-revenue-default",
      priority: 1,
      active: true,
    }),
    createSalesRevenueAccountRule({
      ruleId: "service-revenue",
      companyId: "company-001",
      branchId: null,
      lineKind: "service",
      accountRole: SALES_REVENUE_ACCOUNT_ROLE,
      accountId: "account-revenue-service",
      priority: 1,
      active: true,
    }),
    createSalesRevenueAccountRule({
      ruleId: "branch-stock-revenue",
      companyId: "company-001",
      branchId: "branch-001",
      lineKind: "stock-product",
      accountRole: SALES_REVENUE_ACCOUNT_ROLE,
      accountId: "account-revenue-stock-branch",
      priority: 1,
      active: true,
    }),
  ];
}

test("selects the most specific revenue mapping deterministically", () => {
  const service = selectSalesRevenueAccountRule(rules(), {
    companyId: "company-001",
    branchId: "branch-002",
    lineKind: "service",
    accountRole: SALES_REVENUE_ACCOUNT_ROLE,
  });
  assert.equal(service.ruleId, "service-revenue");

  const stock = selectSalesRevenueAccountRule(rules(), {
    companyId: "company-001",
    branchId: "branch-001",
    lineKind: "stock-product",
    accountRole: SALES_REVENUE_ACCOUNT_ROLE,
  });
  assert.equal(stock.ruleId, "branch-stock-revenue");

  const nonStock = selectSalesRevenueAccountRule(rules(), {
    companyId: "company-001",
    branchId: "branch-002",
    lineKind: "non-stock-product",
    accountRole: SALES_REVENUE_ACCOUNT_ROLE,
  });
  assert.equal(nonStock.ruleId, "default-revenue");
});

test("uses priority only after specificity", () => {
  const selected = selectSalesRevenueAccountRule([
    createSalesRevenueAccountRule({
      ruleId: "generic-high-priority",
      companyId: "company-001",
      branchId: null,
      lineKind: null,
      accountRole: SALES_REVENUE_ACCOUNT_ROLE,
      accountId: "generic",
      priority: 100,
      active: true,
    }),
    createSalesRevenueAccountRule({
      ruleId: "service-specific",
      companyId: "company-001",
      branchId: null,
      lineKind: "service",
      accountRole: SALES_REVENUE_ACCOUNT_ROLE,
      accountId: "service",
      priority: 1,
      active: true,
    }),
  ], {
    companyId: "company-001",
    branchId: "branch-001",
    lineKind: "service",
    accountRole: SALES_REVENUE_ACCOUNT_ROLE,
  });

  assert.equal(selected.ruleId, "service-specific");
});

test("fails closed when no revenue mapping exists", () => {
  assertDomainError(
    () => selectSalesRevenueAccountRule([], {
      companyId: "company-001",
      branchId: "branch-001",
      lineKind: "stock-product",
      accountRole: SALES_REVENUE_ACCOUNT_ROLE,
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.accountMappingMissing,
    "context.accountRole",
  );
});

test("rejects ambiguous equally-specific revenue mappings", () => {
  const duplicateSpecificity = [
    createSalesRevenueAccountRule({
      ruleId: "service-a",
      companyId: "company-001",
      branchId: null,
      lineKind: "service",
      accountRole: SALES_REVENUE_ACCOUNT_ROLE,
      accountId: "account-a",
      priority: 10,
      active: true,
    }),
    createSalesRevenueAccountRule({
      ruleId: "service-b",
      companyId: "company-001",
      branchId: null,
      lineKind: "service",
      accountRole: SALES_REVENUE_ACCOUNT_ROLE,
      accountId: "account-b",
      priority: 10,
      active: true,
    }),
  ];

  assertDomainError(
    () => selectSalesRevenueAccountRule(duplicateSpecificity, {
      companyId: "company-001",
      branchId: "branch-001",
      lineKind: "service",
      accountRole: SALES_REVENUE_ACCOUNT_ROLE,
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleAmbiguous,
    "rules",
  );
});

test("ignores inactive and cross-company revenue rules", () => {
  const selected = selectSalesRevenueAccountRule([
    createSalesRevenueAccountRule({
      ruleId: "inactive",
      companyId: "company-001",
      branchId: null,
      lineKind: "service",
      accountRole: SALES_REVENUE_ACCOUNT_ROLE,
      accountId: "inactive-account",
      priority: 100,
      active: false,
    }),
    createSalesRevenueAccountRule({
      ruleId: "other-company",
      companyId: "company-999",
      branchId: null,
      lineKind: "service",
      accountRole: SALES_REVENUE_ACCOUNT_ROLE,
      accountId: "wrong-company-account",
      priority: 100,
      active: true,
    }),
    createSalesRevenueAccountRule({
      ruleId: "valid",
      companyId: "company-001",
      branchId: null,
      lineKind: null,
      accountRole: SALES_REVENUE_ACCOUNT_ROLE,
      accountId: "valid-account",
      priority: 1,
      active: true,
    }),
  ], {
    companyId: "company-001",
    branchId: "branch-001",
    lineKind: "service",
    accountRole: SALES_REVENUE_ACCOUNT_ROLE,
  });

  assert.equal(selected.ruleId, "valid");
});

test("resolves an active postable account in the same company", async () => {
  const resolution = await resolveSalesRevenueAccount(
    rules(),
    {
      companyId: "company-001",
      branchId: "branch-001",
      lineKind: "service",
      accountRole: SALES_REVENUE_ACCOUNT_ROLE,
    },
    {
      async findById(companyId, accountId) {
        assert.equal(companyId, "company-001");
        assert.equal(accountId, "account-revenue-service");
        return {
          accountId,
          companyId,
          code: "4102",
          name: "Service Revenue",
          status: "active",
          postingAllowed: true,
        };
      },
    },
  );

  assert.equal(resolution.ruleId, "service-revenue");
  assert.equal(resolution.account.accountId, "account-revenue-service");
  assert.equal(resolution.lineKind, "service");
});

test("rejects missing, inactive or non-postable revenue accounts", async () => {
  await assert.rejects(
    () => resolveSalesRevenueAccount(
      rules(),
      {
        companyId: "company-001",
        branchId: "branch-001",
        lineKind: "service",
        accountRole: SALES_REVENUE_ACCOUNT_ROLE,
      },
      { async findById() { return null; } },
    ),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.accountMappingMissing
      && error.field === "rule.accountId",
  );

  await assert.rejects(
    () => resolveSalesRevenueAccount(
      rules(),
      {
        companyId: "company-001",
        branchId: "branch-001",
        lineKind: "service",
        accountRole: SALES_REVENUE_ACCOUNT_ROLE,
      },
      {
        async findById(companyId, accountId) {
          return {
            accountId,
            companyId,
            code: "4102",
            name: "Service Revenue",
            status: "inactive",
            postingAllowed: true,
          };
        },
      },
    ),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.accountNotPostable,
  );
});
