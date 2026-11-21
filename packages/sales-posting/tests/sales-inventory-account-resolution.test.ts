import assert from "node:assert/strict";
import test from "node:test";

import {
  SALES_INVENTORY_ACCOUNT_ROLE,
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  createSalesInventoryAccountRule,
  resolveSalesInventoryAccount,
  selectSalesInventoryAccountRule,
} from "../src/index.ts";

function context() {
  return {
    companyId: "company-001",
    branchId: "branch-001",
    salesLineId: "stock-1",
    productId: "product-001",
    movementId: "movement-001",
    valuationEntryId: "valuation-001",
    warehouseId: "warehouse-001",
    accountRole: SALES_INVENTORY_ACCOUNT_ROLE,
  } as const;
}

function rules() {
  return [
    createSalesInventoryAccountRule({
      ruleId: "inventory-default",
      companyId: "company-001",
      branchId: null,
      accountRole: SALES_INVENTORY_ACCOUNT_ROLE,
      accountId: "account-inventory-default",
      priority: 100,
      active: true,
    }),
    createSalesInventoryAccountRule({
      ruleId: "inventory-branch",
      companyId: "company-001",
      branchId: "branch-001",
      accountRole: SALES_INVENTORY_ACCOUNT_ROLE,
      accountId: "account-inventory-branch",
      priority: 1,
      active: true,
    }),
  ];
}

test("branch-specific Inventory rule outranks company default", () => {
  const selected = selectSalesInventoryAccountRule(rules(), context());
  assert.equal(selected.ruleId, "inventory-branch");
});

test("company default Inventory rule is used without branch override", () => {
  const selected = selectSalesInventoryAccountRule(
    rules(),
    { ...context(), branchId: "branch-002" },
  );
  assert.equal(selected.ruleId, "inventory-default");
});

test("priority breaks ties only between equally specific Inventory rules", () => {
  const selected = selectSalesInventoryAccountRule([
    createSalesInventoryAccountRule({
      ruleId: "low",
      companyId: "company-001",
      branchId: null,
      accountRole: SALES_INVENTORY_ACCOUNT_ROLE,
      accountId: "inventory-low",
      priority: 1,
      active: true,
    }),
    createSalesInventoryAccountRule({
      ruleId: "high",
      companyId: "company-001",
      branchId: null,
      accountRole: SALES_INVENTORY_ACCOUNT_ROLE,
      accountId: "inventory-high",
      priority: 10,
      active: true,
    }),
  ], { ...context(), branchId: "branch-009" });

  assert.equal(selected.ruleId, "high");
});

test("missing and ambiguous Inventory mappings fail closed", () => {
  assert.throws(
    () => selectSalesInventoryAccountRule([], context()),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.accountMappingMissing,
  );

  const ambiguous = [
    createSalesInventoryAccountRule({
      ruleId: "a",
      companyId: "company-001",
      branchId: null,
      accountRole: SALES_INVENTORY_ACCOUNT_ROLE,
      accountId: "account-a",
      priority: 5,
      active: true,
    }),
    createSalesInventoryAccountRule({
      ruleId: "b",
      companyId: "company-001",
      branchId: null,
      accountRole: SALES_INVENTORY_ACCOUNT_ROLE,
      accountId: "account-b",
      priority: 5,
      active: true,
    }),
  ];

  assert.throws(
    () => selectSalesInventoryAccountRule(ambiguous, context()),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleAmbiguous,
  );
});

test("requires stock and valuation/movement provenance in context", () => {
  for (const [field, value] of [
    ["context.salesLineId", { ...context(), salesLineId: " " }],
    ["context.productId", { ...context(), productId: " " }],
    ["context.movementId", { ...context(), movementId: " " }],
    ["context.valuationEntryId", { ...context(), valuationEntryId: " " }],
    ["context.warehouseId", { ...context(), warehouseId: " " }],
  ] as const) {
    assert.throws(
      () => selectSalesInventoryAccountRule(rules(), value),
      (error: unknown) =>
        error instanceof SalesPostingDomainError
        && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.identityRequired
        && error.field === field,
    );
  }
});

test("resolves active postable Inventory account and preserves provenance", async () => {
  const result = await resolveSalesInventoryAccount(
    rules(),
    context(),
    {
      async findById(companyId, accountId) {
        return {
          accountId,
          companyId,
          code: "1301",
          name: "Inventory",
          status: "active",
          postingAllowed: true,
        };
      },
    },
  );

  assert.equal(result.account.accountId, "account-inventory-branch");
  assert.equal(result.salesLineId, "stock-1");
  assert.equal(result.productId, "product-001");
  assert.equal(result.movementId, "movement-001");
  assert.equal(result.valuationEntryId, "valuation-001");
  assert.equal(result.warehouseId, "warehouse-001");
});

test("rejects missing, cross-company, inactive and non-postable Inventory accounts", async () => {
  await assert.rejects(
    () => resolveSalesInventoryAccount(rules(), context(), {
      async findById() { return null; },
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.accountMappingMissing,
  );

  await assert.rejects(
    () => resolveSalesInventoryAccount(rules(), context(), {
      async findById(_companyId, accountId) {
        return {
          accountId,
          companyId: "company-999",
          code: "1301",
          name: "Inventory",
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
    () => resolveSalesInventoryAccount(rules(), context(), {
      async findById(companyId, accountId) {
        return {
          accountId,
          companyId,
          code: "1301",
          name: "Inventory",
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
    () => resolveSalesInventoryAccount(rules(), context(), {
      async findById(companyId, accountId) {
        return {
          accountId,
          companyId,
          code: "1301",
          name: "Inventory",
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

test("warehouse and valuation facts are provenance, not mapping dimensions", () => {
  const first = selectSalesInventoryAccountRule(rules(), context());
  const second = selectSalesInventoryAccountRule(rules(), {
    ...context(),
    warehouseId: "warehouse-999",
    valuationEntryId: "valuation-999",
    movementId: "movement-999",
  });

  assert.equal(first.ruleId, second.ruleId);
  assert.equal("warehouseId" in first, false);
  assert.equal("valuationEntryId" in first, false);
});
