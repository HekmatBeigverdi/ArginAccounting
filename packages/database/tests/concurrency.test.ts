import {
  doesNotThrow,
  equal,
  throws,
} from "node:assert/strict";
import { test } from "node:test";

import {
  ConcurrencyConflictError,
  assertEntityVersion,
  assertVersionedUpdate,
  nextEntityVersion,
} from "../src/index";

test("entity version must be positive", () => {
  doesNotThrow(
    () => assertEntityVersion(1),
  );

  throws(
    () => assertEntityVersion(0),
    TypeError,
  );

  throws(
    () => assertEntityVersion(-1),
    TypeError,
  );

  throws(
    () => assertEntityVersion(1.5),
    TypeError,
  );
});

test("next entity version increments once", () => {
  equal(
    nextEntityVersion(1),
    2,
  );

  equal(
    nextEntityVersion(41),
    42,
  );
});

test("one affected row means successful update", () => {
  doesNotThrow(() =>
    assertVersionedUpdate(
      {
        rowsAffected: 1,
      },
      {
        entityType: "company",
        entityId: "company-1",
        expectedVersion: 3,
      },
    ),
  );
});

test("zero affected rows means concurrency conflict", () => {
  throws(
    () =>
      assertVersionedUpdate(
        {
          rowsAffected: 0,
        },
        {
          entityType: "company",
          entityId: "company-1",
          expectedVersion: 3,
        },
      ),
    (error: unknown) =>
      error instanceof
        ConcurrencyConflictError &&
      error.code ===
        "data.concurrency-conflict" &&
      error.entityType === "company" &&
      error.entityId === "company-1" &&
      error.expectedVersion === 3,
  );
});

test("multiple affected rows are rejected", () => {
  throws(
    () =>
      assertVersionedUpdate(
        {
          rowsAffected: 2,
        },
        {
          entityType: "company",
          entityId: "company-1",
          expectedVersion: 3,
        },
      ),
    /expected exactly one/,
  );
});
