import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
  createPurchasePostingRule,
  resolvePurchasePostingAccount,
  selectPurchasePostingRule,
} from "../src/index.ts";

const context = {
  companyId: "company-001",
  branchId: "branch-001",
  eventKind: "supplier-invoice-recognition" as const,
  lineKind: "stock-product" as const,
  accountRole: "inventory-asset" as const,
};

const baseRule = {
  ruleId: "rule-global-inventory",
  companyId: "company-001",
  branchId: null,
  eventKind: null,
  lineKind: null,
  accountRole: "inventory-asset" as const,
  accountId: "account-inventory-global",
  priority: 10,
  active: true,
};

function assertDomainError(
  action: () => unknown | Promise<unknown>,
  code: string,
  field: string,
): Promise<void> | void {
  const verify = (error: unknown): boolean => {
    assert.ok(error instanceof PurchasePostingDomainError);
    assert.equal(error.code, code);
    assert.equal(error.field, field);
    return true;
  };
  const result = action();
  if (result instanceof Promise) {
    return assert.rejects(result, verify);
  }
  assert.throws(() => { throw result; }, verify);
}

test("creates immutable role-based posting rules", () => {
  const rule = createPurchasePostingRule(baseRule);
  assert.equal(rule.accountRole, "inventory-asset");
  assert.equal(rule.accountId, "account-inventory-global");
  assert.ok(Object.isFrozen(rule));
});

test("prefers the most specific matching rule before priority", () => {
  const selected = selectPurchasePostingRule([
    baseRule,
    {
      ...baseRule,
      ruleId: "rule-event",
      eventKind: "supplier-invoice-recognition",
      accountId: "account-event",
      priority: 100,
    },
    {
      ...baseRule,
      ruleId: "rule-branch-event-line",
      branchId: "branch-001",
      eventKind: "supplier-invoice-recognition",
      lineKind: "stock-product",
      accountId: "account-specific",
      priority: 1,
    },
  ], context);

  assert.equal(selected.ruleId, "rule-branch-event-line");
  assert.equal(selected.accountId, "account-specific");
});

test("uses priority when specificity is equal", () => {
  const selected = selectPurchasePostingRule([
    { ...baseRule, ruleId: "rule-low", priority: 10 },
    { ...baseRule, ruleId: "rule-high", priority: 20, accountId: "account-high" },
  ], context);
  assert.equal(selected.ruleId, "rule-high");
});

test("fails explicitly when account mapping is missing", () => {
  assert.throws(
    () => selectPurchasePostingRule([], context),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.accountMappingMissing);
      return true;
    },
  );
});

test("rejects ambiguous rules with equal specificity and priority", () => {
  assert.throws(
    () => selectPurchasePostingRule([
      { ...baseRule, ruleId: "rule-a" },
      { ...baseRule, ruleId: "rule-b", accountId: "account-b" },
    ], context),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.postingRuleAmbiguous);
      return true;
    },
  );
});

test("resolves only active posting-enabled accounts in the same Company", async () => {
  const resolution = await resolvePurchasePostingAccount(
    [baseRule],
    context,
    {
      async findById(companyId, accountId) {
        return {
          accountId,
          companyId,
          code: "110101",
          name: "موجودی کالا",
          status: "active",
          postingAllowed: true,
        };
      },
    },
  );
  assert.equal(resolution.account.accountId, "account-inventory-global");
  assert.equal(resolution.accountRole, "inventory-asset");
});

test("rejects inactive or non-postable mapped accounts", async () => {
  for (const account of [
    {
      accountId: "account-inventory-global",
      companyId: "company-001",
      code: "110101",
      name: "موجودی کالا",
      status: "inactive" as const,
      postingAllowed: true,
    },
    {
      accountId: "account-inventory-global",
      companyId: "company-001",
      code: "110101",
      name: "موجودی کالا",
      status: "active" as const,
      postingAllowed: false,
    },
  ]) {
    await assert.rejects(
      resolvePurchasePostingAccount([baseRule], context, {
        async findById() { return account; },
      }),
      (error: unknown) => {
        assert.ok(error instanceof PurchasePostingDomainError);
        assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.accountNotPostable);
        return true;
      },
    );
  }
});

test("keeps roles generic and does not hard-code Chart of Accounts IDs", () => {
  const roles = [
    "inventory-asset",
    "purchase-expense",
    "accounts-payable",
    "input-vat-recoverable",
    "purchase-charge",
    "grni",
  ];
  assert.equal(new Set(roles).size, 6);
});
