import assert from "node:assert/strict";
import test from "node:test";
import {
  SalesDomainError,
  applySalesCompareAndSwap,
  assertSalesExpectedVersion,
  createSalesLifecycle,
  createSalesVersionedAggregate,
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
