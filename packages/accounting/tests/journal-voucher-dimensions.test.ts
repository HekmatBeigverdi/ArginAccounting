import assert from "node:assert/strict";
import test from "node:test";

import type { AccountDimensionPolicy } from "../src/domain/account-dimension-policy.ts";
import type { AccountingDimensionMember } from "../src/domain/accounting-dimension-member.ts";
import type { AccountingDimensionType } from "../src/domain/accounting-dimension-type.ts";
import { createJournalVoucher } from "../src/domain/journal-voucher.ts";
import {
  JournalVoucherDimensionValidationError,
  assertValidJournalVoucherDimensions,
  validateJournalVoucherDimensions,
} from "../src/validation/journal-voucher-dimension-validation.ts";

const createdAt = "2026-08-12T10:00:00.000Z";

function dimensionType(
  overrides: Partial<AccountingDimensionType> = {},
): AccountingDimensionType {
  return {
    id: "dimension-type-1",
    companyId: "company-1",
    code: "CC",
    name: "مرکز هزینه",
    englishName: null,
    hierarchical: false,
    allowMultipleMembers: false,
    status: "active",
    displayOrder: 1,
    source: "manual",
    sourceReferenceId: null,
    createdAt,
    updatedAt: createdAt,
    version: 1,
    ...overrides,
  };
}

function member(
  overrides: Partial<AccountingDimensionMember> = {},
): AccountingDimensionMember {
  return {
    id: "member-1",
    companyId: "company-1",
    dimensionTypeId: "dimension-type-1",
    code: "001",
    name: "دفتر مرکزی",
    englishName: null,
    parentId: null,
    status: "active",
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    displayOrder: 1,
    source: "manual",
    sourceReferenceId: null,
    createdAt,
    updatedAt: createdAt,
    version: 1,
    ...overrides,
  };
}

function policy(
  requirement: AccountDimensionPolicy["requirement"],
  accountId = "account-1",
): AccountDimensionPolicy {
  return {
    id: `policy-${accountId}-${requirement}`,
    companyId: "company-1",
    accountId,
    dimensionTypeId: "dimension-type-1",
    requirement,
    createdAt,
    updatedAt: createdAt,
    version: 1,
  };
}

function voucher(
  firstAssignments: readonly {
    dimensionTypeId: string;
    memberIds: readonly string[];
  }[] = [],
) {
  return createJournalVoucher({
    id: "voucher-1",
    companyId: "company-1",
    branchId: "branch-1",
    number: "JV-0001",
    voucherDate: "2026-08-12",
    fiscalYearId: "fy-1",
    fiscalPeriodId: "fp-1",
    createdAt,
    lines: [
      {
        id: "line-1",
        order: 1,
        accountId: "account-1",
        debit: 1000,
        credit: 0,
        dimensionAssignments: firstAssignments,
      },
      {
        id: "line-2",
        order: 2,
        accountId: "account-2",
        debit: 0,
        credit: 1000,
      },
    ],
  });
}

test("accepts required dimension assignment on the matching journal line", () => {
  const issues = validateJournalVoucherDimensions({
    voucher: voucher([
      { dimensionTypeId: "dimension-type-1", memberIds: ["member-1"] },
    ]),
    policies: [policy("required")],
    dimensionTypes: [dimensionType()],
    members: [member()],
  });

  assert.deepEqual(issues, []);
});

test("reports missing required dimension with journal line context", () => {
  const issues = validateJournalVoucherDimensions({
    voucher: voucher(),
    policies: [policy("required")],
    dimensionTypes: [dimensionType()],
    members: [member()],
  });

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.lineId, "line-1");
  assert.equal(issues[0]?.lineOrder, 1);
  assert.equal(issues[0]?.accountId, "account-1");
  assert.equal(issues[0]?.issue.code, "required_dimension_missing");
});

test("rejects a forbidden dimension assignment", () => {
  const issues = validateJournalVoucherDimensions({
    voucher: voucher([
      { dimensionTypeId: "dimension-type-1", memberIds: ["member-1"] },
    ]),
    policies: [policy("forbidden")],
    dimensionTypes: [dimensionType()],
    members: [member()],
  });

  assert.ok(
    issues.some(
      (item) => item.issue.code === "forbidden_dimension_assigned",
    ),
  );
});

test("accepts optional dimension when omitted", () => {
  assert.doesNotThrow(() =>
    assertValidJournalVoucherDimensions({
      voucher: voucher(),
      policies: [policy("optional")],
      dimensionTypes: [dimensionType()],
      members: [member()],
    }),
  );
});

test("propagates inactive type and member validity failures", () => {
  const issues = validateJournalVoucherDimensions({
    voucher: voucher([
      { dimensionTypeId: "dimension-type-1", memberIds: ["member-1"] },
    ]),
    policies: [policy("required")],
    dimensionTypes: [dimensionType({ status: "inactive" })],
    members: [member({ status: "inactive", validTo: "2026-07-31" })],
  });

  const codes = issues.map((item) => item.issue.code);
  assert.ok(codes.includes("dimension_type_inactive"));
  assert.ok(codes.includes("member_inactive"));
  assert.ok(codes.includes("member_expired"));
});

test("propagates company/type mismatch and multiplicity rules", () => {
  const issues = validateJournalVoucherDimensions({
    voucher: voucher([
      {
        dimensionTypeId: "dimension-type-1",
        memberIds: ["member-1", "member-2"],
      },
    ]),
    policies: [policy("required")],
    dimensionTypes: [dimensionType({ allowMultipleMembers: false })],
    members: [
      member({ id: "member-1", companyId: "company-2" }),
      member({ id: "member-2", dimensionTypeId: "dimension-type-2" }),
    ],
  });

  const codes = issues.map((item) => item.issue.code);
  assert.ok(codes.includes("multiple_members_not_allowed"));
  assert.ok(codes.includes("member_company_mismatch"));
  assert.ok(codes.includes("member_type_mismatch"));
});

test("throws one journal-level error containing line-scoped issues", () => {
  assert.throws(
    () =>
      assertValidJournalVoucherDimensions({
        voucher: voucher(),
        policies: [policy("required")],
        dimensionTypes: [dimensionType()],
        members: [member()],
      }),
    (error: unknown) => {
      assert.ok(error instanceof JournalVoucherDimensionValidationError);
      assert.equal(error.issues.length, 1);
      assert.equal(error.issues[0]?.lineId, "line-1");
      return true;
    },
  );
});
