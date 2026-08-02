import assert from "node:assert/strict";
import test from "node:test";

import {
  AccountingDimensionTypeValidationError,
  createAccountingDimensionType,
  type CreateAccountingDimensionTypeInput,
} from "../src/index.ts";

const VALID_INPUT: CreateAccountingDimensionTypeInput = {
  id: "dimension-type-project",
  companyId: "company-1",
  code: "PROJECT",
  name: "پروژه",
  englishName: "Project",
  hierarchical: true,
  allowMultipleMembers: false,
  status: "active",
  displayOrder: 10,
  source: "manual",
  sourceReferenceId: null,
  createdAt: "2026-07-31T08:30:00.000Z",
};

test("creates an immutable company-scoped dimension type", () => {
  const dimensionType =
    createAccountingDimensionType(VALID_INPUT);

  assert.deepEqual(dimensionType, {
    ...VALID_INPUT,
    createdAt: VALID_INPUT.createdAt,
    updatedAt: VALID_INPUT.createdAt,
    version: 1,
  });
  assert.equal(Object.isFrozen(dimensionType), true);
});

test("normalizes text and applies safe defaults", () => {
  const dimensionType =
    createAccountingDimensionType({
      id: " dimension-type-cost-center ",
      companyId: " company-1 ",
      code: " cost_center ",
      name: " مرکز هزینه ",
      englishName: " ",
      createdAt: " 2026-07-31T08:30:00.000Z ",
    });

  assert.equal(
    dimensionType.id,
    "dimension-type-cost-center",
  );
  assert.equal(dimensionType.companyId, "company-1");
  assert.equal(dimensionType.code, "COST_CENTER");
  assert.equal(dimensionType.name, "مرکز هزینه");
  assert.equal(dimensionType.englishName, null);
  assert.equal(dimensionType.hierarchical, false);
  assert.equal(
    dimensionType.allowMultipleMembers,
    false,
  );
  assert.equal(dimensionType.status, "active");
  assert.equal(dimensionType.displayOrder, 0);
  assert.equal(dimensionType.source, "manual");
  assert.equal(dimensionType.sourceReferenceId, null);
});

test("preserves sync-ready stable identity and initial version", () => {
  const dimensionType =
    createAccountingDimensionType(VALID_INPUT);

  assert.equal(
    dimensionType.id,
    "dimension-type-project",
  );
  assert.equal(dimensionType.companyId, "company-1");
  assert.equal(dimensionType.version, 1);
  assert.match(dimensionType.createdAt, /Z$/);
  assert.equal(
    dimensionType.updatedAt,
    dimensionType.createdAt,
  );
});

test("supports system and module provenance", () => {
  const dimensionType =
    createAccountingDimensionType({
      ...VALID_INPUT,
      source: "module",
      sourceReferenceId: "projects",
    });

  assert.equal(dimensionType.source, "module");
  assert.equal(
    dimensionType.sourceReferenceId,
    "projects",
  );
});

test("rejects empty required fields", () => {
  assert.throws(
    () =>
      createAccountingDimensionType({
        ...VALID_INPUT,
        id: " ",
        companyId: "",
        code: " ",
        name: "",
        createdAt: " ",
      }),
    (error: unknown) => {
      assert.ok(
        error instanceof
          AccountingDimensionTypeValidationError,
      );
      assert.deepEqual(
        error.issues.map((issue) => issue.field),
        [
          "id",
          "companyId",
          "code",
          "name",
          "createdAt",
          "updatedAt",
        ],
      );
      return true;
    },
  );
});

test("rejects invalid code, display order and missing source reference", () => {
  assert.throws(
    () =>
      createAccountingDimensionType({
        ...VALID_INPUT,
        code: "123 پروژه",
        displayOrder: -1,
        source: "system",
        sourceReferenceId: null,
      }),
    (error: unknown) => {
      assert.ok(
        error instanceof
          AccountingDimensionTypeValidationError,
      );
      assert.deepEqual(
        error.issues.map((issue) => issue.field),
        [
          "code",
          "displayOrder",
          "sourceReferenceId",
        ],
      );
      return true;
    },
  );
});
