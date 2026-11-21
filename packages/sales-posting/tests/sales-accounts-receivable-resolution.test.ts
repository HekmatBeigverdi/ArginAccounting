import assert from "node:assert/strict";
import test from "node:test";

import {
  SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  createSalesAccountsReceivableAccountRule,
  resolveSalesAccountsReceivableAccount,
  selectSalesAccountsReceivableAccountRule,
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
    createSalesAccountsReceivableAccountRule({
      ruleId: "ar-default",
      companyId: "company-001",
      branchId: null,
      accountRole: SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
      accountId: "account-ar-default",
      priority: 1,
      active: true,
    }),
    createSalesAccountsReceivableAccountRule({
      ruleId: "ar-branch-001",
      companyId: "company-001",
      branchId: "branch-001",
      accountRole: SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
      accountId: "account-ar-branch-001",
      priority: 1,
      active: true,
    }),
  ];
}

test("selects branch-specific AR before company default", () => {
  const branchSpecific = selectSalesAccountsReceivableAccountRule(rules(), {
    companyId: "company-001",
    branchId: "branch-001",
    customerPartyId: "customer-001",
    accountRole: SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
  });
  assert.equal(branchSpecific.ruleId, "ar-branch-001");

  const companyDefault = selectSalesAccountsReceivableAccountRule(rules(), {
    companyId: "company-001",
    branchId: "branch-002",
    customerPartyId: "customer-002",
    accountRole: SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
  });
  assert.equal(companyDefault.ruleId, "ar-default");
});

test("keeps customer identity out of control-account selection", () => {
  const first = selectSalesAccountsReceivableAccountRule(rules(), {
    companyId: "company-001",
    branchId: "branch-002",
    customerPartyId: "customer-001",
    accountRole: SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
  });
  const second = selectSalesAccountsReceivableAccountRule(rules(), {
    companyId: "company-001",
    branchId: "branch-002",
    customerPartyId: "customer-999",
    accountRole: SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
  });

  assert.equal(first.accountId, "account-ar-default");
  assert.equal(second.accountId, "account-ar-default");
});

test("uses priority only between equally-specific AR rules", () => {
  const selected = selectSalesAccountsReceivableAccountRule([
    createSalesAccountsReceivableAccountRule({
      ruleId: "low",
      companyId: "company-001",
      branchId: null,
      accountRole: SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
      accountId: "account-low",
      priority: 1,
      active: true,
    }),
    createSalesAccountsReceivableAccountRule({
      ruleId: "high",
      companyId: "company-001",
      branchId: null,
      accountRole: SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
      accountId: "account-high",
      priority: 10,
      active: true,
    }),
  ], {
    companyId: "company-001",
    branchId: "branch-001",
    customerPartyId: "customer-001",
    accountRole: SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
  });

  assert.equal(selected.ruleId, "high");
});

test("fails closed when no AR mapping exists", () => {
  assertDomainError(
    () => selectSalesAccountsReceivableAccountRule([], {
      companyId: "company-001",
      branchId: "branch-001",
      customerPartyId: "customer-001",
      accountRole: SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.accountMappingMissing,
    "context.accountRole",
  );
});

test("rejects ambiguous equally-specific AR mappings", () => {
  const duplicate = [
    createSalesAccountsReceivableAccountRule({
      ruleId: "ar-a",
      companyId: "company-001",
      branchId: null,
      accountRole: SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
      accountId: "account-a",
      priority: 10,
      active: true,
    }),
    createSalesAccountsReceivableAccountRule({
      ruleId: "ar-b",
      companyId: "company-001",
      branchId: null,
      accountRole: SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
      accountId: "account-b",
      priority: 10,
      active: true,
    }),
  ];

  assertDomainError(
    () => selectSalesAccountsReceivableAccountRule(duplicate, {
      companyId: "company-001",
      branchId: "branch-001",
      customerPartyId: "customer-001",
      accountRole: SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleAmbiguous,
    "rules",
  );
});

test("validates required customer party identity", () => {
  assertDomainError(
    () => selectSalesAccountsReceivableAccountRule(rules(), {
      companyId: "company-001",
      branchId: "branch-001",
      customerPartyId: " ",
      accountRole: SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.identityRequired,
    "context.customerPartyId",
  );
});

test("resolves active postable AR account and preserves customer party provenance", async () => {
  const resolution = await resolveSalesAccountsReceivableAccount(
    rules(),
    {
      companyId: "company-001",
      branchId: "branch-001",
      customerPartyId: "customer-001",
      accountRole: SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
    },
    {
      async findById(companyId, accountId) {
        assert.equal(companyId, "company-001");
        assert.equal(accountId, "account-ar-branch-001");
        return {
          accountId,
          companyId,
          code: "1201",
          name: "Accounts Receivable",
          status: "active",
          postingAllowed: true,
        };
      },
    },
  );

  assert.equal(resolution.ruleId, "ar-branch-001");
  assert.equal(resolution.customerPartyId, "customer-001");
  assert.equal(resolution.account.accountId, "account-ar-branch-001");
});

test("rejects missing, wrong-company, inactive and non-postable AR accounts", async () => {
  const context = {
    companyId: "company-001",
    branchId: "branch-001",
    customerPartyId: "customer-001",
    accountRole: SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
  } as const;

  await assert.rejects(
    () => resolveSalesAccountsReceivableAccount(
      rules(),
      context,
      { async findById() { return null; } },
    ),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.accountMappingMissing
      && error.field === "rule.accountId",
  );

  await assert.rejects(
    () => resolveSalesAccountsReceivableAccount(
      rules(),
      context,
      {
        async findById(_companyId, accountId) {
          return {
            accountId,
            companyId: "company-999",
            code: "1201",
            name: "Wrong Company AR",
            status: "active",
            postingAllowed: true,
          };
        },
      },
    ),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.accountInvalid,
  );

  await assert.rejects(
    () => resolveSalesAccountsReceivableAccount(
      rules(),
      context,
      {
        async findById(companyId, accountId) {
          return {
            accountId,
            companyId,
            code: "1201",
            name: "Inactive AR",
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

  await assert.rejects(
    () => resolveSalesAccountsReceivableAccount(
      rules(),
      context,
      {
        async findById(companyId, accountId) {
          return {
            accountId,
            companyId,
            code: "1201",
            name: "Non-postable AR",
            status: "active",
            postingAllowed: false,
          };
        },
      },
    ),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.accountNotPostable,
  );
});
