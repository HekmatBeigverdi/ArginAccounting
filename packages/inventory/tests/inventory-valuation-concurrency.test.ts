import assert from "node:assert/strict";
import test from "node:test";
import {
  InventoryValuationConcurrencyError,
  assertInventoryValuationExpectedRevision,
  decideInventoryValuationReplay,
  inventoryValuationPolicyStreamKey,
  inventoryValuationProductStreamKey,
  type InventoryValuationIdempotencyRecord,
} from "../src/application/contracts/inventory-valuation-concurrency.ts";

const record: InventoryValuationIdempotencyRecord = Object.freeze({
  companyId: "company-1",
  requestId: "request-1",
  operation: "resolve-movement",
  payloadFingerprint: "sha256:abc",
  outcomeKind: "valuation",
  outcomeId: "valuation-1",
  outcomeRevision: 1,
  recordedAt: "2026-09-12T19:00:00.000Z",
});

test("new request proceeds when no idempotency record exists", () => {
  assert.deepEqual(decideInventoryValuationReplay({
    existing: null,
    companyId: "company-1",
    requestId: "request-1",
    operation: "resolve-movement",
    payloadFingerprint: "sha256:abc",
  }), { kind: "new" });
});

test("same request and fingerprint replays durable outcome", () => {
  const decision = decideInventoryValuationReplay({
    existing: record,
    companyId: record.companyId,
    requestId: record.requestId,
    operation: record.operation,
    payloadFingerprint: record.payloadFingerprint,
  });
  assert.equal(decision.kind, "replay");
  if (decision.kind === "replay") assert.equal(decision.record.outcomeId, "valuation-1");
});

test("request id reuse with different payload is rejected", () => {
  assert.throws(
    () => decideInventoryValuationReplay({
      existing: record,
      companyId: record.companyId,
      requestId: record.requestId,
      operation: record.operation,
      payloadFingerprint: "sha256:different",
    }),
    (error: unknown) => error instanceof InventoryValuationConcurrencyError && error.code === "VALUATION_IDEMPOTENCY_CONFLICT",
  );
});

test("expected revision rejects stale writers", () => {
  assert.doesNotThrow(() => assertInventoryValuationExpectedRevision(4, 4));
  assert.throws(
    () => assertInventoryValuationExpectedRevision(5, 4),
    (error: unknown) => error instanceof InventoryValuationConcurrencyError && error.code === "VALUATION_CONCURRENCY_CONFLICT",
  );
});

test("stream keys isolate company policy and company product valuation streams", () => {
  assert.equal(inventoryValuationPolicyStreamKey(" company-1 "), "policy:company-1");
  assert.equal(inventoryValuationProductStreamKey("company-1", "product-8"), "valuation:company-1:product-8");
});
