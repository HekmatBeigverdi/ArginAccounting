import assert from "node:assert/strict";
import test from "node:test";
import {
  InventoryValuationPolicyError,
  assertDirectInventoryValuationPolicyMutationAllowed,
  assertInventoryValuationPolicyHistory,
  createInitialInventoryValuationPolicy,
  createInventoryValuationPolicyTransition,
  resolveInventoryValuationPolicy,
} from "../src/domain/inventory-valuation-policy.ts";

const initial = createInitialInventoryValuationPolicy({
  policyId: "policy-1",
  companyId: "company-1",
  method: "moving_average",
  effectiveFrom: "2026-01-01",
});

test("initial policy is company-scoped and defaults currency/version deterministically", () => {
  assert.equal(initial.companyId, "company-1");
  assert.equal(initial.method, "moving_average");
  assert.equal(initial.currency, "IRR");
  assert.equal(initial.strategyVersion, 1);
  assert.equal(initial.previousPolicyId, null);
  assert.equal(initial.revision, 1);
});

test("product and warehouse streams consume the same company policy", () => {
  const a = resolveInventoryValuationPolicy([initial], {
    companyId: "company-1",
    productId: "product-a",
    warehouseId: "warehouse-a",
    businessDate: "2026-09-11",
  });
  const b = resolveInventoryValuationPolicy([initial], {
    companyId: "company-1",
    productId: "product-b",
    warehouseId: "warehouse-b",
    businessDate: "2026-09-11",
  });

  assert.equal(a.policy.policyId, "policy-1");
  assert.equal(b.policy.policyId, "policy-1");
  assert.equal(a.policy.method, b.policy.method);
});

test("controlled transition preserves history and becomes effective by business date", () => {
  const transition = createInventoryValuationPolicyTransition({
    policyId: "policy-2",
    current: initial,
    method: "fifo",
    effectiveFrom: "2027-01-01",
    changeReason: "Adopt FIFO from the new fiscal year",
  });

  assert.equal(transition.previousPolicyId, "policy-1");
  assert.equal(transition.changeReason, "Adopt FIFO from the new fiscal year");
  assert.equal(transition.revision, 2);

  const before = resolveInventoryValuationPolicy([initial, transition], {
    companyId: "company-1",
    productId: "product-1",
    warehouseId: "warehouse-1",
    businessDate: "2026-12-29",
  });
  const after = resolveInventoryValuationPolicy([initial, transition], {
    companyId: "company-1",
    productId: "product-1",
    warehouseId: "warehouse-1",
    businessDate: "2027-01-01",
  });

  assert.equal(before.policy.method, "moving_average");
  assert.equal(after.policy.method, "fifo");
});

test("direct method mutation is locked after authoritative valuation begins", () => {
  assert.doesNotThrow(() => assertDirectInventoryValuationPolicyMutationAllowed({ hasAuthoritativeValuation: false }));
  assert.throws(
    () => assertDirectInventoryValuationPolicyMutationAllowed({ hasAuthoritativeValuation: true }),
    (error: unknown) => error instanceof InventoryValuationPolicyError && error.code === "VALUATION_POLICY_DIRECT_MUTATION_LOCKED",
  );
});

test("transition must move forward in chronology and include a reason", () => {
  assert.throws(
    () => createInventoryValuationPolicyTransition({
      policyId: "policy-2",
      current: initial,
      method: "fifo",
      effectiveFrom: "2026-01-01",
      changeReason: "invalid same-date transition",
    }),
    (error: unknown) => error instanceof InventoryValuationPolicyError && error.code === "VALUATION_POLICY_TRANSITION_INVALID",
  );

  assert.throws(
    () => createInventoryValuationPolicyTransition({
      policyId: "policy-2",
      current: initial,
      method: "fifo",
      effectiveFrom: "2027-01-01",
      changeReason: "   ",
    }),
    (error: unknown) => error instanceof InventoryValuationPolicyError && error.code === "VALUATION_POLICY_TRANSITION_INVALID",
  );
});

test("policy history rejects overlap and broken previous-policy chain", () => {
  const transition = createInventoryValuationPolicyTransition({
    policyId: "policy-2",
    current: initial,
    method: "fifo",
    effectiveFrom: "2027-01-01",
    changeReason: "new fiscal year",
  });
  assert.doesNotThrow(() => assertInventoryValuationPolicyHistory([initial, transition]));

  const overlapping = createInitialInventoryValuationPolicy({
    policyId: "policy-overlap",
    companyId: "company-1",
    method: "fifo",
    effectiveFrom: "2026-01-01",
  });
  assert.throws(
    () => assertInventoryValuationPolicyHistory([initial, overlapping]),
    (error: unknown) => error instanceof InventoryValuationPolicyError && error.code === "VALUATION_POLICY_OVERLAP",
  );
});

test("resolution fails when no company policy is effective", () => {
  assert.throws(
    () => resolveInventoryValuationPolicy([initial], {
      companyId: "company-1",
      productId: "product-1",
      warehouseId: "warehouse-1",
      businessDate: "2025-12-31",
    }),
    (error: unknown) => error instanceof InventoryValuationPolicyError && error.code === "VALUATION_POLICY_NOT_FOUND",
  );
});
