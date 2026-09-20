import assert from "node:assert/strict";
import test from "node:test";
import {
  createInventoryValuationTraceSnapshot,
  inventoryValuationPermissions,
} from "../src/application/contracts/inventory-valuation-security.ts";

const policy = Object.freeze({
  policyId: "policy-1",
  companyId: "company-1",
  method: "fifo" as const,
  strategyVersion: 1,
  currency: "IRR" as const,
  effectiveFrom: "2026-03-21",
  previousPolicyId: null,
  changeReason: null,
  revision: 1,
});

const costInput = Object.freeze({
  basisLineId: "basis-1",
  movementId: "movement-1",
  productId: "product-1",
  warehouseId: "warehouse-1",
  quantity: "10",
  currency: "IRR" as const,
  baseCost: 1000,
  landedCost: 100,
  totalCost: 1100,
  unitCost: "110",
  allocations: Object.freeze([]),
});

const entry = Object.freeze({
  valuationEntryId: "entry-1",
  companyId: "company-1",
  productId: "product-1",
  stockKey: Object.freeze({ companyId: "company-1", productId: "product-1", warehouseId: "warehouse-1", zoneId: null, locationId: null }),
  source: Object.freeze({ movementId: "movement-1", documentId: "doc-1", lineId: "line-1", reversalOfMovementId: null, transferId: null }),
  kind: "inbound" as const,
  method: "fifo" as const,
  strategyVersion: 1,
  currency: "IRR" as const,
  businessDate: "2026-09-13",
  businessOrder: 1,
  quantity: "10",
  unitCost: "110",
  totalCost: 1100,
  costState: "resolved" as const,
  unresolvedReason: null,
  valuedAt: "2026-09-13T00:00:00.000Z",
  revision: 1,
});

test("valuation permissions separate viewing from privileged monetary mutations", () => {
  assert.equal(inventoryValuationPermissions.view, "inventory.valuation.view");
  assert.equal(inventoryValuationPermissions.policyManage, "inventory.valuation.policy.manage");
  assert.equal(inventoryValuationPermissions.costInputCorrect, "inventory.valuation.cost-input.correct");
  assert.equal(inventoryValuationPermissions.recalculate, "inventory.valuation.recalculate");
  assert.notEqual(inventoryValuationPermissions.view, inventoryValuationPermissions.policyManage);
});

test("trace links movement to cost input and valuation entry with applied policy", () => {
  const trace = createInventoryValuationTraceSnapshot({
    companyId: "company-1",
    movementId: "movement-1",
    productId: "product-1",
    policy,
    costInput,
    entry,
  });
  assert.equal(trace.links.length, 3);
  assert.deepEqual(trace.links.map(link => link.relation), [
    "movement-costed-by",
    "cost-input-valued-as",
    "policy-applied-to",
  ]);
});

test("trace rejects mismatched movement cost input", () => {
  assert.throws(() => createInventoryValuationTraceSnapshot({
    companyId: "company-1",
    movementId: "movement-other",
    productId: "product-1",
    policy,
    costInput,
    entry: null,
  }), /VALUATION_TRACE_COST_INPUT_MISMATCH/u);
});

test("trace supports unresolved valuation with policy provenance and no cost input", () => {
  const unresolved = Object.freeze({ ...entry, unitCost: null, totalCost: null, costState: "unresolved" as const, unresolvedReason: "missing_inbound_cost", valuedAt: null });
  const trace = createInventoryValuationTraceSnapshot({
    companyId: "company-1",
    movementId: "movement-1",
    productId: "product-1",
    policy,
    costInput: null,
    entry: unresolved,
  });
  assert.deepEqual(trace.links.map(link => link.relation), ["policy-applied-to"]);
});
