import assert from "node:assert/strict";
import test from "node:test";

import {
  SALES_OUTPUT_VAT_ACCOUNT_ROLE,
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  createSalesOutputVatAccountRule,
  resolveSalesOutputVatAccount,
  selectSalesOutputVatAccountRule,
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
    createSalesOutputVatAccountRule({
      ruleId: "vat-default",
      companyId: "company-001",
      branchId: null,
      taxCode: null,
      accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
      accountId: "account-vat-default",
      priority: 1,
      active: true,
    }),
    createSalesOutputVatAccountRule({
      ruleId: "vat-standard",
      companyId: "company-001",
      branchId: null,
      taxCode: "VAT",
      accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
      accountId: "account-vat-standard",
      priority: 1,
      active: true,
    }),
    createSalesOutputVatAccountRule({
      ruleId: "vat-branch",
      companyId: "company-001",
      branchId: "branch-001",
      taxCode: "VAT",
      accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
      accountId: "account-vat-branch",
      priority: 1,
      active: true,
    }),
  ];
}

test("selects most specific Output VAT mapping", () => {
  const branch = selectSalesOutputVatAccountRule(rules(), {
    companyId: "company-001",
    branchId: "branch-001",
    taxId: "vat-10",
    taxCode: "vat",
    rateBasisPoints: 1000,
    accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
  });
  assert.equal(branch.ruleId, "vat-branch");

  const standard = selectSalesOutputVatAccountRule(rules(), {
    companyId: "company-001",
    branchId: "branch-002",
    taxId: "vat-10",
    taxCode: "VAT",
    rateBasisPoints: 1000,
    accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
  });
  assert.equal(standard.ruleId, "vat-standard");

  const fallback = selectSalesOutputVatAccountRule(rules(), {
    companyId: "company-001",
    branchId: "branch-002",
    taxId: "other-tax",
    taxCode: "OTHER",
    rateBasisPoints: 500,
    accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
  });
  assert.equal(fallback.ruleId, "vat-default");
});

test("normalizes tax code without changing authoritative rate fact", async () => {
  const resolution = await resolveSalesOutputVatAccount(
    rules(),
    {
      companyId: "company-001",
      branchId: "branch-002",
      taxId: "vat-10",
      taxCode: " vat ",
      rateBasisPoints: 1000,
      accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
    },
    {
      async findById(companyId, accountId) {
        return {
          accountId,
          companyId,
          code: "2402",
          name: "Output VAT",
          status: "active",
          postingAllowed: true,
        };
      },
    },
  );

  assert.equal(resolution.taxCode, "VAT");
  assert.equal(resolution.rateBasisPoints, 1000);
  assert.equal(resolution.account.accountId, "account-vat-standard");
});

test("uses specificity before priority for VAT mappings", () => {
  const selected = selectSalesOutputVatAccountRule([
    createSalesOutputVatAccountRule({
      ruleId: "generic-high",
      companyId: "company-001",
      branchId: null,
      taxCode: null,
      accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
      accountId: "generic",
      priority: 100,
      active: true,
    }),
    createSalesOutputVatAccountRule({
      ruleId: "tax-specific",
      companyId: "company-001",
      branchId: null,
      taxCode: "VAT",
      accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
      accountId: "specific",
      priority: 1,
      active: true,
    }),
  ], {
    companyId: "company-001",
    branchId: "branch-001",
    taxId: "vat-10",
    taxCode: "VAT",
    rateBasisPoints: 1000,
    accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
  });

  assert.equal(selected.ruleId, "tax-specific");
});

test("fails closed when no Output VAT mapping exists", () => {
  assertDomainError(
    () => selectSalesOutputVatAccountRule([], {
      companyId: "company-001",
      branchId: "branch-001",
      taxId: "vat-10",
      taxCode: "VAT",
      rateBasisPoints: 1000,
      accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.accountMappingMissing,
    "context.accountRole",
  );
});

test("rejects ambiguous Output VAT mappings", () => {
  const duplicate = [
    createSalesOutputVatAccountRule({
      ruleId: "vat-a",
      companyId: "company-001",
      branchId: null,
      taxCode: "VAT",
      accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
      accountId: "account-a",
      priority: 10,
      active: true,
    }),
    createSalesOutputVatAccountRule({
      ruleId: "vat-b",
      companyId: "company-001",
      branchId: null,
      taxCode: "VAT",
      accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
      accountId: "account-b",
      priority: 10,
      active: true,
    }),
  ];

  assertDomainError(
    () => selectSalesOutputVatAccountRule(duplicate, {
      companyId: "company-001",
      branchId: "branch-001",
      taxId: "vat-10",
      taxCode: "VAT",
      rateBasisPoints: 1000,
      accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleAmbiguous,
    "rules",
  );
});

test("validates authoritative tax fact shape", () => {
  assertDomainError(
    () => selectSalesOutputVatAccountRule(rules(), {
      companyId: "company-001",
      branchId: "branch-001",
      taxId: " ",
      taxCode: "VAT",
      rateBasisPoints: 1000,
      accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.identityRequired,
    "context.taxId",
  );

  assertDomainError(
    () => selectSalesOutputVatAccountRule(rules(), {
      companyId: "company-001",
      branchId: "branch-001",
      taxId: "vat",
      taxCode: "VAT",
      rateBasisPoints: 10001,
      accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
    }),
    SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid,
    "context.rateBasisPoints",
  );
});

test("rejects missing, wrong-company, inactive and non-postable VAT accounts", async () => {
  const context = {
    companyId: "company-001",
    branchId: "branch-001",
    taxId: "vat-10",
    taxCode: "VAT",
    rateBasisPoints: 1000,
    accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
  } as const;

  await assert.rejects(
    () => resolveSalesOutputVatAccount(
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
    () => resolveSalesOutputVatAccount(
      rules(),
      context,
      {
        async findById(_companyId, accountId) {
          return {
            accountId,
            companyId: "company-999",
            code: "2402",
            name: "Wrong Company VAT",
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
    () => resolveSalesOutputVatAccount(
      rules(),
      context,
      {
        async findById(companyId, accountId) {
          return {
            accountId,
            companyId,
            code: "2402",
            name: "Inactive VAT",
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
    () => resolveSalesOutputVatAccount(
      rules(),
      context,
      {
        async findById(companyId, accountId) {
          return {
            accountId,
            companyId,
            code: "2402",
            name: "Non-postable VAT",
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
