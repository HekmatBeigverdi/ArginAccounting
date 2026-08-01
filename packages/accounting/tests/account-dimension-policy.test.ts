import assert from "node:assert/strict";
import test from "node:test";

import {
  AccountDimensionPolicyValidationError,
  createAccountDimensionPolicy,
  type CreateAccountDimensionPolicyInput,
} from "../src/index.ts";

const VALID_INPUT: CreateAccountDimensionPolicyInput = {
  id: "policy-account-project",
  companyId: "company-1",
  accountId: "account-100",
  dimensionTypeId: "dimension-type-project",
  requirement: "required",
  createdAt: "2026-08-01T08:30:00.000Z",
};

test("creates an immutable company-scoped account dimension policy", () => {
  const policy = createAccountDimensionPolicy(VALID_INPUT);

  assert.deepEqual(policy, {
    ...VALID_INPUT,
    updatedAt: VALID_INPUT.createdAt,
    version: 1,
  });
  assert.equal(Object.isFrozen(policy), true);
});

test("normalizes stable identifiers and timestamps", () => {
  const policy = createAccountDimensionPolicy({
    ...VALID_INPUT,
    id: " policy-account-project ",
    companyId: " company-1 ",
    accountId: " account-100 ",
    dimensionTypeId: " dimension-type-project ",
    createdAt: " 2026-08-01T08:30:00.000Z ",
  });

  assert.equal(policy.id, "policy-account-project");
  assert.equal(policy.companyId, "company-1");
  assert.equal(policy.accountId, "account-100");
  assert.equal(
    policy.dimensionTypeId,
    "dimension-type-project",
  );
  assert.equal(
    policy.updatedAt,
    "2026-08-01T08:30:00.000Z",
  );
  assert.equal(policy.version, 1);
});

test("supports required dimension assignment", () => {
  const policy = createAccountDimensionPolicy({
    ...VALID_INPUT,
    requirement: "required",
  });

  assert.equal(policy.requirement, "required");
});

test("supports optional dimension assignment", () => {
  const policy = createAccountDimensionPolicy({
    ...VALID_INPUT,
    requirement: "optional",
  });

  assert.equal(policy.requirement, "optional");
});

test("supports forbidden dimension assignment", () => {
  const policy = createAccountDimensionPolicy({
    ...VALID_INPUT,
    requirement: "forbidden",
  });

  assert.equal(policy.requirement, "forbidden");
});

test("rejects empty required identifiers and timestamps", () => {
  assert.throws(
    () =>
      createAccountDimensionPolicy({
        ...VALID_INPUT,
        id: " ",
        companyId: "",
        accountId: " ",
        dimensionTypeId: "",
        createdAt: " ",
      }),
    (error: unknown) => {
      assert.ok(
        error instanceof
          AccountDimensionPolicyValidationError,
      );
      assert.deepEqual(
        error.issues.map((issue) => issue.field),
        [
          "id",
          "companyId",
          "accountId",
          "dimensionTypeId",
          "createdAt",
          "updatedAt",
        ],
      );
      return true;
    },
  );
});

test("rejects an unsupported requirement at the domain boundary", () => {
  assert.throws(
    () =>
      createAccountDimensionPolicy({
        ...VALID_INPUT,
        requirement: "unknown",
      } as unknown as CreateAccountDimensionPolicyInput),
    (error: unknown) => {
      assert.ok(
        error instanceof
          AccountDimensionPolicyValidationError,
      );
      assert.deepEqual(
        error.issues.map((issue) => issue.field),
        ["requirement"],
      );
      return true;
    },
  );
});
