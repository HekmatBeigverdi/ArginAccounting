import assert from "node:assert/strict";
import test from "node:test";
import {
  SalesDomainError,
  applySalesCompareAndSwap,
  assertSalesExpectedVersion,
  createSalesLifecycle,
  createSalesVersionedAggregate,
  createSalesIdempotencyRecord,
  createSalesMutationContext,
  prepareSalesMutation,
  transitionSalesLifecycleWithVersion,
} from "../src/index.ts";

test("creates versioned aggregate at version 1 by default", () => {
  const aggregate = createSalesVersionedAggregate({ documentId: "inv-1" });
  assert.equal(aggregate.version, 1);
  assert.deepEqual(aggregate.value, { documentId: "inv-1" });
});

test("successful CAS mutation increments version exactly once", () => {
  const current = createSalesVersionedAggregate({ description: "old" }, 3);
  const next = applySalesCompareAndSwap(
    current,
    { expectedVersion: 3 },
    (value) => ({ ...value, description: "new" }),
  );
  assert.equal(next.version, 4);
  assert.equal(next.value.description, "new");
  assert.equal(current.version, 3);
  assert.equal(current.value.description, "old");
});

test("stale expectedVersion is rejected without invoking mutation", () => {
  const current = createSalesVersionedAggregate({ value: 1 }, 2);
  let called = false;
  assert.throws(
    () => applySalesCompareAndSwap(current, { expectedVersion: 1 }, (value) => {
      called = true;
      return { value: value.value + 1 };
    }),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.concurrency_conflict",
  );
  assert.equal(called, false);
  assert.equal(current.version, 2);
});

test("lifecycle transition uses expectedVersion and increments aggregate version", () => {
  const current = createSalesVersionedAggregate(createSalesLifecycle("inv-1", "sales-invoice"));
  const submitted = transitionSalesLifecycleWithVersion(current, {
    expectedVersion: 1,
    transitionId: "t-1",
    action: "submit",
    actorId: "user-1",
    occurredAt: "2026-10-02T10:00:00Z",
  });
  assert.equal(submitted.value.status, "submitted");
  assert.equal(submitted.version, 2);
});

test("second caller using stale lifecycle version conflicts", () => {
  const base = createSalesVersionedAggregate(createSalesLifecycle("inv-1", "sales-invoice"));
  const submitted = transitionSalesLifecycleWithVersion(base, {
    expectedVersion: 1,
    transitionId: "t-1",
    action: "submit",
    actorId: "user-1",
    occurredAt: "2026-10-02T10:00:00Z",
  });
  assert.equal(submitted.version, 2);

  assert.throws(
    () => transitionSalesLifecycleWithVersion(submitted, {
      expectedVersion: 1,
      transitionId: "t-2",
      action: "cancel",
      actorId: "user-2",
      occurredAt: "2026-10-02T10:01:00Z",
    }),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.concurrency_conflict",
  );
});

test("invalid versions are rejected explicitly", () => {
  assert.throws(
    () => assertSalesExpectedVersion(1, 0),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.version_invalid",
  );
  assert.throws(
    () => createSalesVersionedAggregate({ id: "x" }, 1.5),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.version_invalid",
  );
});


test("exact replay is returned before stale expectedVersion is evaluated", async () => {
  const mutation = createSalesMutationContext({
    companyId: "co-1",
    branchId: "br-1",
    requestId: "req-1",
    operationId: "op-1",
    operation: "sales-invoice:update",
    payloadFingerprint: "sha256:a",
    actorUserId: "user-1",
    occurredAt: "2026-10-02T10:00:00Z",
  });
  const stored = createSalesIdempotencyRecord({
    context: mutation,
    outcomeKind: "sales-document",
    outcomeId: "inv-1",
    outcomeVersion: 1,
    outcomeStatus: "draft",
    resultJson: JSON.stringify({ documentId: "inv-1", version: 1 }),
    recordedAt: "2026-10-02T10:00:01Z",
  });
  const reader = {
    async findByRequestId() { return stored; },
    async findByOperationId() { return stored; },
  };
  const decision = await prepareSalesMutation(reader, mutation, 5, 1);
  assert.equal(decision.kind, "replay");
});

test("new mutation performs expectedVersion validation", async () => {
  const mutation = createSalesMutationContext({
    companyId: "co-1",
    branchId: "br-1",
    requestId: "req-new",
    operationId: "op-new",
    operation: "sales-invoice:update",
    payloadFingerprint: "sha256:b",
    actorUserId: "user-1",
    occurredAt: "2026-10-02T10:00:00Z",
  });
  const reader = {
    async findByRequestId() { return null; },
    async findByOperationId() { return null; },
  };
  await assert.rejects(
    () => prepareSalesMutation(reader, mutation, 5, 4),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.concurrency_conflict",
  );
});
