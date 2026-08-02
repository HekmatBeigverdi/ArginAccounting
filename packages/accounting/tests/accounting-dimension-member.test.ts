import assert from "node:assert/strict";
import test from "node:test";

import {
  AccountingDimensionMemberValidationError,
  createAccountingDimensionMember,
  type CreateAccountingDimensionMemberInput,
} from "../src/index.ts";

const VALID_INPUT: CreateAccountingDimensionMemberInput = {
  id: "dimension-member-project-100",
  companyId: "company-1",
  dimensionTypeId: "dimension-type-project",
  code: "PRJ-100",
  name: "پروژه توسعه آرگین",
  englishName: "Argin Development Project",
  parentId: null,
  status: "active",
  validFrom: "2026-01-01",
  validTo: "2026-12-31",
  displayOrder: 10,
  source: "manual",
  sourceReferenceId: null,
  createdAt: "2026-08-01T08:30:00.000Z",
};

test("creates an immutable company-scoped dimension member", () => {
  const member =
    createAccountingDimensionMember(VALID_INPUT);

  assert.deepEqual(member, {
    ...VALID_INPUT,
    updatedAt: VALID_INPUT.createdAt,
    version: 1,
  });
  assert.equal(Object.isFrozen(member), true);
});

test("normalizes text and applies safe defaults", () => {
  const member =
    createAccountingDimensionMember({
      id: " member-cost-center-sales ",
      companyId: " company-1 ",
      dimensionTypeId: " dimension-type-cost-center ",
      code: " cc.sales ",
      name: " فروش ",
      englishName: " ",
      parentId: " ",
      createdAt: " 2026-08-01T08:30:00.000Z ",
    });

  assert.equal(member.id, "member-cost-center-sales");
  assert.equal(member.companyId, "company-1");
  assert.equal(
    member.dimensionTypeId,
    "dimension-type-cost-center",
  );
  assert.equal(member.code, "CC.SALES");
  assert.equal(member.name, "فروش");
  assert.equal(member.englishName, null);
  assert.equal(member.parentId, null);
  assert.equal(member.status, "active");
  assert.equal(member.validFrom, null);
  assert.equal(member.validTo, null);
  assert.equal(member.displayOrder, 0);
  assert.equal(member.source, "manual");
  assert.equal(member.sourceReferenceId, null);
});

test("supports hierarchy and module provenance without module coupling", () => {
  const member =
    createAccountingDimensionMember({
      ...VALID_INPUT,
      parentId: "dimension-member-projects",
      source: "module",
      sourceReferenceId: "projects:project-100",
    });

  assert.equal(
    member.parentId,
    "dimension-member-projects",
  );
  assert.equal(member.source, "module");
  assert.equal(
    member.sourceReferenceId,
    "projects:project-100",
  );
});

test("supports open-ended effective date ranges", () => {
  const withoutEnd =
    createAccountingDimensionMember({
      ...VALID_INPUT,
      validTo: null,
    });
  const withoutStart =
    createAccountingDimensionMember({
      ...VALID_INPUT,
      validFrom: null,
    });

  assert.equal(withoutEnd.validTo, null);
  assert.equal(withoutStart.validFrom, null);
});

test("rejects empty required fields", () => {
  assert.throws(
    () =>
      createAccountingDimensionMember({
        ...VALID_INPUT,
        id: " ",
        companyId: "",
        dimensionTypeId: " ",
        code: "",
        name: " ",
        createdAt: " ",
      }),
    (error: unknown) => {
      assert.ok(
        error instanceof
          AccountingDimensionMemberValidationError,
      );
      assert.deepEqual(
        error.issues.map((issue) => issue.field),
        [
          "id",
          "companyId",
          "dimensionTypeId",
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

test("rejects invalid code, self-parent and reversed date range", () => {
  assert.throws(
    () =>
      createAccountingDimensionMember({
        ...VALID_INPUT,
        code: "پروژه ۱",
        parentId: VALID_INPUT.id,
        validFrom: "2026-12-31",
        validTo: "2026-01-01",
      }),
    (error: unknown) => {
      assert.ok(
        error instanceof
          AccountingDimensionMemberValidationError,
      );
      assert.deepEqual(
        error.issues.map((issue) => issue.field),
        ["code", "parentId", "validTo"],
      );
      return true;
    },
  );
});

test("rejects invalid dates, display order and missing source reference", () => {
  assert.throws(
    () =>
      createAccountingDimensionMember({
        ...VALID_INPUT,
        validFrom: "2026-02-30",
        validTo: "01/08/2026",
        displayOrder: 1.5,
        source: "system",
        sourceReferenceId: null,
      }),
    (error: unknown) => {
      assert.ok(
        error instanceof
          AccountingDimensionMemberValidationError,
      );
      assert.deepEqual(
        error.issues.map((issue) => issue.field),
        [
          "validFrom",
          "validTo",
          "displayOrder",
          "sourceReferenceId",
        ],
      );
      return true;
    },
  );
});
