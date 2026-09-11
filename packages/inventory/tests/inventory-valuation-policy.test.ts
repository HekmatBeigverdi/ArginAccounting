import assert from "node:assert/strict";
import test from "node:test";
import {
  InventoryValuationPolicyError,
  assessInventoryValuationPolicyChange,
  createInventoryValuationPolicy,
  resolveInventoryValuationPolicy,
} from "../src/index.ts";

const company = createInventoryValuationPolicy({
  policyId: "company-default",
  companyId: "company-1",
  scope: "company",
  method: "moving_average",
  effectiveFrom: "2026-01-01",
});

test("company policy is the required valuation default", () => {
  const result = resolveInventoryValuationPolicy([company], {
    companyId: "company-1",
    productId: "product-1",
    warehouseId: "warehouse-1",
    businessDate: "2026-09-11",
  });

  assert.equal(result.matchedScope, "company");
  assert.equal(result.policy.method, "moving_average");
  assert.equal(result.policy.currency, "IRR");
});

test("product override wins over warehouse override and company default", () => {
  const warehouse = createInventoryValuationPolicy({
    policyId: "warehouse-policy",
    companyId: "company-1",
    scope: "warehouse",
    warehouseId: "warehouse-1",
    method: "fifo",
    effectiveFrom: "2026-01-01",
  });
  const product = createInventoryValuationPolicy({
    policyId: "product-policy",
    companyId: "company-1",
    scope: "product",
    productId: "product-1",
    method: "fifo",
    effectiveFrom: "2026-02-01",
  });

  const result = resolveInventoryValuationPolicy([company, warehouse, product], {
    companyId: "company-1",
    productId: "product-1",
    warehouseId: "warehouse-1",
    businessDate: "2026-09-11",
  });

  assert.equal(result.matchedScope, "product");
  assert.equal(result.policy.policyId, "product-policy");
});

test("product+warehouse override is the most specific policy", () => {
  const productWarehouse = createInventoryValuationPolicy({
    policyId: "product-warehouse-policy",
    companyId: "company-1",
    scope: "product_warehouse",
    productId: "product-1",
    warehouseId: "warehouse-1",
    method: "fifo",
    effectiveFrom: "2026-03-01",
  });
  const product = createInventoryValuationPolicy({
    policyId: "product-policy",
    companyId: "company-1",
    scope: "product",
    productId: "product-1",
    method: "moving_average",
    effectiveFrom: "2026-03-01",
  });

  const result = resolveInventoryValuationPolicy([company, product, productWarehouse], {
    companyId: "company-1",
    productId: "product-1",
    warehouseId: "warehouse-1",
    businessDate: "2026-09-11",
  });

  assert.equal(result.matchedScope, "product_warehouse");
  assert.equal(result.policy.method, "fifo");
});

test("future-dated policy does not affect earlier business dates", () => {
  const future = createInventoryValuationPolicy({
    policyId: "future-product",
    companyId: "company-1",
    scope: "product",
    productId: "product-1",
    method: "fifo",
    effectiveFrom: "2027-01-01",
  });

  const before = resolveInventoryValuationPolicy([company, future], {
    companyId: "company-1",
    productId: "product-1",
    warehouseId: "warehouse-1",
    businessDate: "2026-12-31",
  });
  const after = resolveInventoryValuationPolicy([company, future], {
    companyId: "company-1",
    productId: "product-1",
    warehouseId: "warehouse-1",
    businessDate: "2027-01-01",
  });

  assert.equal(before.matchedScope, "company");
  assert.equal(after.policy.policyId, "future-product");
});

test("invalid scope/reference combinations are rejected", () => {
  assert.throws(
    () => createInventoryValuationPolicy({
      policyId: "bad",
      companyId: "company-1",
      scope: "warehouse",
      productId: "product-1",
      method: "fifo",
      effectiveFrom: "2026-01-01",
    }),
    (error: unknown) => error instanceof InventoryValuationPolicyError && error.code === "VALUATION_POLICY_SCOPE_INVALID",
  );
});

test("overlapping same-scope policy at same effective date is rejected", () => {
  const first = createInventoryValuationPolicy({
    policyId: "p1",
    companyId: "company-1",
    scope: "product",
    productId: "product-1",
    method: "fifo",
    effectiveFrom: "2026-05-01",
  });
  const second = createInventoryValuationPolicy({
    policyId: "p2",
    companyId: "company-1",
    scope: "product",
    productId: "product-1",
    method: "moving_average",
    effectiveFrom: "2026-05-01",
  });

  assert.throws(
    () => resolveInventoryValuationPolicy([company, first, second], {
      companyId: "company-1",
      productId: "product-1",
      warehouseId: "warehouse-1",
      businessDate: "2026-09-11",
    }),
    (error: unknown) => error instanceof InventoryValuationPolicyError && error.code === "VALUATION_POLICY_OVERLAP",
  );
});

test("historical method change requires explicit recalculation approval", () => {
  const current = createInventoryValuationPolicy({
    policyId: "product-policy",
    companyId: "company-1",
    scope: "product",
    productId: "product-1",
    method: "moving_average",
    effectiveFrom: "2026-01-01",
  });
  const proposed = createInventoryValuationPolicy({
    policyId: "product-policy",
    companyId: "company-1",
    scope: "product",
    productId: "product-1",
    method: "fifo",
    effectiveFrom: "2026-06-01",
    revision: 2,
  });

  assert.throws(
    () => assessInventoryValuationPolicyChange({
      current,
      proposed,
      hasValuationHistory: true,
      latestValuedBusinessDate: "2026-09-11",
    }),
    (error: unknown) => error instanceof InventoryValuationPolicyError && error.code === "VALUATION_POLICY_HISTORICAL_CHANGE_REQUIRES_RECALCULATION",
  );

  const approved = assessInventoryValuationPolicyChange({
    current,
    proposed,
    hasValuationHistory: true,
    latestValuedBusinessDate: "2026-09-11",
    historicalRecalculationApproved: true,
  });

  assert.equal(approved.allowed, true);
  assert.equal(approved.requiresRecalculation, true);
});

test("future semantic change does not require historical recalculation", () => {
  const current = createInventoryValuationPolicy({
    policyId: "product-policy",
    companyId: "company-1",
    scope: "product",
    productId: "product-1",
    method: "moving_average",
    effectiveFrom: "2026-01-01",
  });
  const proposed = createInventoryValuationPolicy({
    policyId: "product-policy",
    companyId: "company-1",
    scope: "product",
    productId: "product-1",
    method: "fifo",
    effectiveFrom: "2027-01-01",
    revision: 2,
  });

  const assessment = assessInventoryValuationPolicyChange({
    current,
    proposed,
    hasValuationHistory: true,
    latestValuedBusinessDate: "2026-09-11",
  });

  assert.equal(assessment.allowed, true);
  assert.equal(assessment.requiresRecalculation, false);
  assert.equal(assessment.changedValuationSemantics, true);
});
