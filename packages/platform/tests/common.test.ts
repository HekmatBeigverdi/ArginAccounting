import assert from "node:assert/strict";
import test from "node:test";

import {
  FixedClock,
  PlatformError,
  SequenceIdGenerator,
  createChildCorrelationContext,
  createCorrelationContext,
  createIdempotencyScope,
  failure,
  isFailure,
  isSuccess,
  mapResult,
  success,
  unwrapResult,
} from "../src/index.ts";

test("success creates a successful result", () => {
  const result = success(42);

  assert.equal(isSuccess(result), true);
  assert.equal(result.value, 42);
  assert.equal(unwrapResult(result), 42);
});

test("failure creates a failed result", () => {
  const error = PlatformError.validation(
    "test.invalid-value",
    "The value is invalid.",
  );

  const result = failure(error);

  assert.equal(isFailure(result), true);

  if (result.ok) {
    assert.fail("Expected a failed result.");
  }

  assert.equal(result.error.code, "test.invalid-value");
  assert.equal(result.error.category, "validation");
  assert.throws(() => unwrapResult(result), error);
});

test("mapResult maps only successful values", () => {
  const mapped = mapResult(success(4), (value) => value * 2);

  assert.deepEqual(mapped, success(8));

  const error = PlatformError.notFound(
    "test.not-found",
    "The test entity was not found.",
  );

  assert.deepEqual(
    mapResult(failure(error), (value: number) => value * 2),
    failure(error),
  );
});

test("FixedClock returns an isolated fixed date", () => {
  const clock = new FixedClock("2026-07-25T10:30:00.000Z");

  const first = clock.now();
  first.setUTCFullYear(2030);

  assert.equal(
    clock.nowIso(),
    "2026-07-25T10:30:00.000Z",
  );
});

test("SequenceIdGenerator creates predictable identifiers", () => {
  const generator = new SequenceIdGenerator("entity", 10);

  assert.equal(generator.generate(), "entity-10");
  assert.equal(generator.generate(), "entity-11");
});

test("correlation context creates a child relationship", () => {
  const generator = new SequenceIdGenerator("correlation");

  const parent = createCorrelationContext(generator, {
    userId: "user-1",
    companyId: "company-1",
    branchId: "branch-1",
  });

  const child = createChildCorrelationContext(parent, generator);

  assert.equal(parent.correlationId, "correlation-1");
  assert.equal(child.correlationId, "correlation-2");
  assert.equal(child.causationId, parent.correlationId);
  assert.equal(child.userId, parent.userId);
  assert.equal(child.companyId, parent.companyId);
  assert.equal(child.branchId, parent.branchId);
});

test("createIdempotencyScope creates a stable operation key", () => {
  assert.equal(
    createIdempotencyScope("invoice.post", "invoice-100"),
    "invoice.post:invoice-100",
  );

  assert.throws(
    () => createIdempotencyScope("", "invoice-100"),
    TypeError,
  );
});
