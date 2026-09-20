import assert from "node:assert/strict";
import test from "node:test";
import {
  INVENTORY_VALUATION_DERIVED_SYNC_ENTITIES,
  INVENTORY_VALUATION_SYNC_CONTRACT_VERSION,
  InventoryValuationSyncContractError,
  assertInventoryValuationEntityIsAuthoritativeForSync,
  createInventoryValuationCostInputSyncEnvelope,
  createInventoryValuationPolicySyncEnvelope,
} from "../src/application/contracts/inventory-valuation-sync.ts";

const origin = Object.freeze({ sourceSystem: "argin-desktop", sourceInstanceId: "desktop-1" });

const metadata = Object.freeze({
  operationId: "op-1",
  requestId: "req-1",
  idempotencyKey: "idem-1",
  payloadFingerprint: "sha256:abc",
  changedAt: "2026-09-13T00:00:00+03:30",
  origin,
  serverRevision: null,
});

test("policy envelope carries append-only policy identity and predecessor dependency", () => {
  const envelope = createInventoryValuationPolicySyncEnvelope({
    ...metadata,
    streamKey: "policy:company-1",
    streamRevision: 2,
    snapshot: {
      policyId: "policy-2",
      companyId: "company-1",
      method: "fifo",
      strategyVersion: 1,
      currency: "IRR",
      effectiveFrom: "2027-01-01",
      previousPolicyId: "policy-1",
      changeReason: "Fiscal year transition",
      revision: 2,
    },
  });

  assert.equal(envelope.contractVersion, INVENTORY_VALUATION_SYNC_CONTRACT_VERSION);
  assert.equal(envelope.entity, "valuation-policy");
  assert.equal(envelope.changeKind, "append");
  assert.equal(envelope.streamRevision, 2);
  assert.deepEqual(envelope.dependencies, [{ entity: "valuation-policy", id: "policy-1" }]);
  assert.equal(envelope.changedAt, "2026-09-12T20:30:00.000Z");
});

test("policy envelope rejects stream identity or revision mismatch", () => {
  assert.throws(
    () => createInventoryValuationPolicySyncEnvelope({
      ...metadata,
      streamKey: "policy:another-company",
      streamRevision: 1,
      snapshot: {
        policyId: "policy-1",
        companyId: "company-1",
        method: "moving_average",
        strategyVersion: 1,
        currency: "IRR",
        effectiveFrom: "2026-01-01",
        previousPolicyId: null,
        changeReason: null,
        revision: 1,
      },
    }),
    (error: unknown) => error instanceof InventoryValuationSyncContractError && error.code === "valuation.sync.snapshot-mismatch",
  );
});

test("cost input envelope depends on immutable Phase 20 movement and carries product stream revision", () => {
  const envelope = createInventoryValuationCostInputSyncEnvelope({
    ...metadata,
    operationId: "op-cost-1",
    requestId: "req-cost-1",
    idempotencyKey: "idem-cost-1",
    payloadFingerprint: "sha256:cost",
    streamKey: "valuation:company-1:product-1",
    streamRevision: 8,
    companyId: "company-1",
    revision: 3,
    snapshot: {
      basisLineId: "basis-1",
      movementId: "movement-1",
      productId: "product-1",
      warehouseId: "warehouse-1",
      quantity: "2",
      currency: "IRR",
      baseCost: 1000,
      landedCost: 200,
      totalCost: 1200,
      unitCost: "600",
      allocations: Object.freeze([]),
    },
  });

  assert.equal(envelope.entity, "valuation-cost-input");
  assert.equal(envelope.changeKind, "upsert");
  assert.equal(envelope.streamRevision, 8);
  assert.equal(envelope.revision, 3);
  assert.deepEqual(envelope.dependencies, [{ entity: "inventory-movement", id: "movement-1" }]);
});

test("derived valuation projections are explicitly excluded from authoritative Bridge entities", () => {
  assert.deepEqual(INVENTORY_VALUATION_DERIVED_SYNC_ENTITIES, ["valuation-entry", "valuation-cost-layer", "valuation-state"]);
  assert.throws(
    () => assertInventoryValuationEntityIsAuthoritativeForSync("valuation-entry"),
    (error: unknown) => error instanceof InventoryValuationSyncContractError && error.code === "valuation.sync.snapshot-mismatch",
  );
  assert.doesNotThrow(() => assertInventoryValuationEntityIsAuthoritativeForSync("valuation-policy"));
  assert.doesNotThrow(() => assertInventoryValuationEntityIsAuthoritativeForSync("valuation-cost-input"));
});

test("external references must be unique per source system and external id", () => {
  assert.throws(
    () => createInventoryValuationPolicySyncEnvelope({
      ...metadata,
      streamKey: "policy:company-1",
      streamRevision: 1,
      externalReferences: [
        { sourceSystem: "server", externalId: "42" },
        { sourceSystem: "SERVER", externalId: "42" },
      ],
      snapshot: {
        policyId: "policy-1",
        companyId: "company-1",
        method: "fifo",
        strategyVersion: 1,
        currency: "IRR",
        effectiveFrom: "2026-01-01",
        previousPolicyId: null,
        changeReason: null,
        revision: 1,
      },
    }),
    (error: unknown) => error instanceof InventoryValuationSyncContractError && error.code === "valuation.sync.external-reference-duplicate",
  );
});
