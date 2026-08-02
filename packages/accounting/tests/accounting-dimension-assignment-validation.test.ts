import assert from "node:assert/strict";
import test from "node:test";

import {
  AccountingDimensionAssignmentValidationError,
  assertValidAccountingDimensionAssignments,
  createAccountDimensionPolicy,
  createAccountingDimensionMember,
  createAccountingDimensionType,
  validateAccountingDimensionAssignments,
  type ValidateAccountingDimensionAssignmentsInput,
} from "../src/index.ts";

const CREATED_AT = "2026-08-01T08:30:00.000Z";

function createInput(
  overrides: Partial<ValidateAccountingDimensionAssignmentsInput> = {},
): ValidateAccountingDimensionAssignmentsInput {
  const projectType = createAccountingDimensionType({
    id: "type-project",
    companyId: "company-1",
    code: "PROJECT",
    name: "پروژه",
    allowMultipleMembers: false,
    createdAt: CREATED_AT,
  });
  const costCenterType = createAccountingDimensionType({
    id: "type-cost-center",
    companyId: "company-1",
    code: "COST_CENTER",
    name: "مرکز هزینه",
    allowMultipleMembers: true,
    createdAt: CREATED_AT,
  });
  const project = createAccountingDimensionMember({
    id: "project-100",
    companyId: "company-1",
    dimensionTypeId: "type-project",
    code: "PRJ-100",
    name: "پروژه آرگین",
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    createdAt: CREATED_AT,
  });
  const costCenter = createAccountingDimensionMember({
    id: "cost-center-sales",
    companyId: "company-1",
    dimensionTypeId: "type-cost-center",
    code: "CC.SALES",
    name: "فروش",
    createdAt: CREATED_AT,
  });

  return {
    companyId: "company-1",
    accountId: "account-expense",
    documentDate: "2026-08-01",
    policies: [
      createAccountDimensionPolicy({
        id: "policy-project",
        companyId: "company-1",
        accountId: "account-expense",
        dimensionTypeId: "type-project",
        requirement: "required",
        createdAt: CREATED_AT,
      }),
      createAccountDimensionPolicy({
        id: "policy-cost-center",
        companyId: "company-1",
        accountId: "account-expense",
        dimensionTypeId: "type-cost-center",
        requirement: "optional",
        createdAt: CREATED_AT,
      }),
    ],
    dimensionTypes: [projectType, costCenterType],
    members: [project, costCenter],
    assignments: [
      {
        dimensionTypeId: "type-project",
        memberIds: ["project-100"],
      },
    ],
    ...overrides,
  };
}

test("accepts valid required and optional dimension assignments", () => {
  const issues = validateAccountingDimensionAssignments(createInput());

  assert.deepEqual(issues, []);
  assert.equal(Object.isFrozen(issues), true);
  assert.doesNotThrow(() =>
    assertValidAccountingDimensionAssignments(createInput()),
  );
});

test("reports a missing required dimension", () => {
  const issues = validateAccountingDimensionAssignments(
    createInput({ assignments: [] }),
  );

  assert.deepEqual(
    issues.map((issue) => issue.code),
    ["required_dimension_missing"],
  );
});

test("rejects an assignment forbidden by the account policy", () => {
  const input = createInput();
  const forbiddenPolicy = createAccountDimensionPolicy({
    id: "policy-project-forbidden",
    companyId: input.companyId,
    accountId: input.accountId,
    dimensionTypeId: "type-project",
    requirement: "forbidden",
    createdAt: CREATED_AT,
  });

  const issues = validateAccountingDimensionAssignments({
    ...input,
    policies: [forbiddenPolicy],
  });

  assert.ok(
    issues.some(
      (issue) => issue.code === "forbidden_dimension_assigned",
    ),
  );
});

test("rejects assignments without an explicit account policy", () => {
  const input = createInput();
  const issues = validateAccountingDimensionAssignments({
    ...input,
    policies: input.policies.filter(
      (policy) => policy.dimensionTypeId !== "type-project",
    ),
  });

  assert.ok(
    issues.some((issue) => issue.code === "policy_not_defined"),
  );
});

test("ignores policies from another company or account", () => {
  const input = createInput();
  const foreignPolicies = input.policies.map((policy, index) =>
    createAccountDimensionPolicy({
      ...policy,
      id: `foreign-policy-${index}`,
      companyId: index === 0 ? "company-2" : input.companyId,
      accountId: index === 0 ? input.accountId : "account-other",
    }),
  );

  const issues = validateAccountingDimensionAssignments({
    ...input,
    policies: foreignPolicies,
  });

  assert.ok(issues.some((issue) => issue.code === "policy_not_defined"));
});

test("accepts an omitted optional dimension and an empty assignment", () => {
  const input = createInput();
  const issues = validateAccountingDimensionAssignments({
    ...input,
    assignments: [
      input.assignments[0]!,
      { dimensionTypeId: "type-cost-center", memberIds: [] },
    ],
  });

  assert.deepEqual(issues, []);
});

test("enforces single-member dimension types and detects duplicates", () => {
  const input = createInput();
  const issues = validateAccountingDimensionAssignments({
    ...input,
    assignments: [
      {
        dimensionTypeId: "type-project",
        memberIds: ["project-100", "project-100"],
      },
      {
        dimensionTypeId: "type-project",
        memberIds: ["project-100"],
      },
    ],
  });

  assert.ok(
    issues.some((issue) => issue.code === "duplicate_assignment"),
  );
  assert.ok(
    issues.some(
      (issue) => issue.code === "multiple_members_not_allowed",
    ),
  );
  assert.ok(
    issues.some((issue) => issue.code === "duplicate_member"),
  );
});

test("validates member company, dimension type, status, and existence", () => {
  const input = createInput();
  const mismatchedMember = createAccountingDimensionMember({
    id: "invalid-member",
    companyId: "company-2",
    dimensionTypeId: "type-cost-center",
    code: "INVALID-1",
    name: "عضو نامعتبر",
    status: "inactive",
    createdAt: CREATED_AT,
  });
  const issues = validateAccountingDimensionAssignments({
    ...input,
    members: [...input.members, mismatchedMember],
    assignments: [
      {
        dimensionTypeId: "type-project",
        memberIds: ["invalid-member", "missing-member"],
      },
    ],
  });

  const codes = issues.map((issue) => issue.code);
  assert.ok(codes.includes("member_company_mismatch"));
  assert.ok(codes.includes("member_type_mismatch"));
  assert.ok(codes.includes("member_inactive"));
  assert.ok(codes.includes("member_not_found"));
});

test("validates member effective dates against the business document date", () => {
  const input = createInput();
  const beforeStart = validateAccountingDimensionAssignments({
    ...input,
    documentDate: "2025-12-31",
  });
  const afterEnd = validateAccountingDimensionAssignments({
    ...input,
    documentDate: "2027-01-01",
  });

  assert.ok(
    beforeStart.some(
      (issue) => issue.code === "member_not_yet_valid",
    ),
  );
  assert.ok(
    afterEnd.some((issue) => issue.code === "member_expired"),
  );
});

test("reports inactive and unknown dimension types", () => {
  const input = createInput();
  const inactiveType = createAccountingDimensionType({
    id: "type-project",
    companyId: "company-1",
    code: "PROJECT",
    name: "پروژه",
    status: "inactive",
    createdAt: CREATED_AT,
  });
  const inactiveIssues = validateAccountingDimensionAssignments({
    ...input,
    dimensionTypes: [inactiveType],
  });
  const unknownIssues = validateAccountingDimensionAssignments({
    ...input,
    dimensionTypes: [],
  });

  assert.ok(
    inactiveIssues.some(
      (issue) => issue.code === "dimension_type_inactive",
    ),
  );
  assert.ok(
    unknownIssues.some(
      (issue) => issue.code === "dimension_type_not_found",
    ),
  );
});

test("reports duplicate policy configuration and invalid document date", () => {
  const input = createInput();
  const duplicatePolicy = createAccountDimensionPolicy({
    id: "policy-project-duplicate",
    companyId: input.companyId,
    accountId: input.accountId,
    dimensionTypeId: "type-project",
    requirement: "optional",
    createdAt: CREATED_AT,
  });
  const issues = validateAccountingDimensionAssignments({
    ...input,
    documentDate: "2026-02-30",
    policies: [...input.policies, duplicatePolicy],
  });

  assert.ok(
    issues.some((issue) => issue.code === "invalid_document_date"),
  );
  assert.ok(
    issues.some((issue) => issue.code === "duplicate_policy"),
  );
});

test("throws a field-addressable validation error at the assertion boundary", () => {
  assert.throws(
    () =>
      assertValidAccountingDimensionAssignments(
        createInput({ assignments: [] }),
      ),
    (error: unknown) => {
      assert.ok(
        error instanceof
          AccountingDimensionAssignmentValidationError,
      );
      assert.equal(error.issues[0]?.dimensionTypeId, "type-project");
      assert.equal(error.issues[0]?.memberId, null);
      return true;
    },
  );
});
