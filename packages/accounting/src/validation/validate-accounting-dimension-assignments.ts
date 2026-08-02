import type {
  AccountDimensionPolicy,
} from "../domain/account-dimension-policy.ts";
import type {
  AccountingDimensionAssignment,
} from "../domain/accounting-dimension-assignment.ts";
import type {
  AccountingDimensionMember,
} from "../domain/accounting-dimension-member.ts";
import type {
  AccountingDimensionType,
} from "../domain/accounting-dimension-type.ts";
import {
  AccountingDimensionAssignmentValidationError,
  type AccountingDimensionAssignmentValidationIssue,
} from "./accounting-dimension-assignment-validation-error.ts";

export interface ValidateAccountingDimensionAssignmentsInput {
  readonly companyId: string;
  readonly accountId: string;
  readonly documentDate: string;
  readonly policies: readonly AccountDimensionPolicy[];
  readonly dimensionTypes: readonly AccountingDimensionType[];
  readonly members: readonly AccountingDimensionMember[];
  readonly assignments: readonly AccountingDimensionAssignment[];
}

export function validateAccountingDimensionAssignments(
  input: ValidateAccountingDimensionAssignmentsInput,
): readonly AccountingDimensionAssignmentValidationIssue[] {
  const issues: AccountingDimensionAssignmentValidationIssue[] = [];
  const documentDateIsValid = isValidIsoDate(input.documentDate);

  if (!documentDateIsValid) {
    addIssue(
      issues,
      "invalid_document_date",
      null,
      null,
      "تاریخ سند باید یک تاریخ معتبر با قالب YYYY-MM-DD باشد.",
    );
  }

  const policies = input.policies.filter(
    (policy) =>
      policy.companyId === input.companyId &&
      policy.accountId === input.accountId,
  );
  const policiesByType = groupBy(
    policies,
    (policy) => policy.dimensionTypeId,
  );
  const assignmentsByType = groupBy(
    input.assignments,
    (assignment) => assignment.dimensionTypeId,
  );
  const typesById = new Map(
    input.dimensionTypes
      .filter((type) => type.companyId === input.companyId)
      .map((type) => [type.id, type]),
  );
  const membersById = new Map(
    input.members.map((member) => [member.id, member]),
  );

  for (const [dimensionTypeId, matchingPolicies] of policiesByType) {
    if (matchingPolicies.length > 1) {
      addIssue(
        issues,
        "duplicate_policy",
        dimensionTypeId,
        null,
        "برای این حساب و نوع بُعد بیش از یک سیاست تعریف شده است.",
      );
    }

    const policy = matchingPolicies[0];
    if (policy === undefined) continue;
    const assignedMemberCount =
      assignmentsByType.get(dimensionTypeId)?.reduce(
        (count, assignment) => count + assignment.memberIds.length,
        0,
      ) ?? 0;

    if (
      policy.requirement === "required" &&
      assignedMemberCount === 0
    ) {
      addIssue(
        issues,
        "required_dimension_missing",
        dimensionTypeId,
        null,
        "انتخاب حداقل یک عضو برای این بُعد الزامی است.",
      );
    }

    if (
      policy.requirement === "forbidden" &&
      assignedMemberCount > 0
    ) {
      addIssue(
        issues,
        "forbidden_dimension_assigned",
        dimensionTypeId,
        null,
        "تخصیص این بُعد برای حساب انتخاب‌شده ممنوع است.",
      );
    }
  }

  for (const [dimensionTypeId, matchingAssignments] of assignmentsByType) {
    if (matchingAssignments.length > 1) {
      addIssue(
        issues,
        "duplicate_assignment",
        dimensionTypeId,
        null,
        "هر نوع بُعد باید فقط یک‌بار در تخصیص‌های آرتیکل حضور داشته باشد.",
      );
    }

    if (!policiesByType.has(dimensionTypeId)) {
      addIssue(
        issues,
        "policy_not_defined",
        dimensionTypeId,
        null,
        "برای استفاده از این بُعد در حساب انتخاب‌شده سیاستی تعریف نشده است.",
      );
    }

    const dimensionType = typesById.get(dimensionTypeId);
    if (dimensionType === undefined) {
      addIssue(
        issues,
        "dimension_type_not_found",
        dimensionTypeId,
        null,
        "نوع بُعد حسابداری در شرکت جاری پیدا نشد.",
      );
    } else if (dimensionType.status !== "active") {
      addIssue(
        issues,
        "dimension_type_inactive",
        dimensionTypeId,
        null,
        "نوع بُعد حسابداری غیرفعال است.",
      );
    }

    const memberIds = matchingAssignments.flatMap(
      (assignment) => assignment.memberIds,
    );
    if (
      dimensionType !== undefined &&
      !dimensionType.allowMultipleMembers &&
      memberIds.length > 1
    ) {
      addIssue(
        issues,
        "multiple_members_not_allowed",
        dimensionTypeId,
        null,
        "برای این نوع بُعد انتخاب بیش از یک عضو مجاز نیست.",
      );
    }

    const seenMemberIds = new Set<string>();
    for (const memberId of memberIds) {
      if (seenMemberIds.has(memberId)) {
        addIssue(
          issues,
          "duplicate_member",
          dimensionTypeId,
          memberId,
          "عضو بُعد در این تخصیص تکرار شده است.",
        );
        continue;
      }
      seenMemberIds.add(memberId);

      const member = membersById.get(memberId);
      if (member === undefined) {
        addIssue(
          issues,
          "member_not_found",
          dimensionTypeId,
          memberId,
          "عضو بُعد حسابداری پیدا نشد.",
        );
        continue;
      }

      if (member.companyId !== input.companyId) {
        addIssue(
          issues,
          "member_company_mismatch",
          dimensionTypeId,
          memberId,
          "عضو بُعد متعلق به شرکت جاری نیست.",
        );
      }
      if (member.dimensionTypeId !== dimensionTypeId) {
        addIssue(
          issues,
          "member_type_mismatch",
          dimensionTypeId,
          memberId,
          "عضو انتخاب‌شده متعلق به این نوع بُعد نیست.",
        );
      }
      if (member.status !== "active") {
        addIssue(
          issues,
          "member_inactive",
          dimensionTypeId,
          memberId,
          "عضو بُعد حسابداری غیرفعال است.",
        );
      }
      if (
        documentDateIsValid &&
        member.validFrom !== null &&
        input.documentDate < member.validFrom
      ) {
        addIssue(
          issues,
          "member_not_yet_valid",
          dimensionTypeId,
          memberId,
          "اعتبار عضو بُعد در تاریخ سند هنوز آغاز نشده است.",
        );
      }
      if (
        documentDateIsValid &&
        member.validTo !== null &&
        input.documentDate > member.validTo
      ) {
        addIssue(
          issues,
          "member_expired",
          dimensionTypeId,
          memberId,
          "اعتبار عضو بُعد در تاریخ سند پایان یافته است.",
        );
      }
    }
  }

  return Object.freeze(issues);
}

export function assertValidAccountingDimensionAssignments(
  input: ValidateAccountingDimensionAssignmentsInput,
): void {
  const issues = validateAccountingDimensionAssignments(input);
  if (issues.length > 0) {
    throw new AccountingDimensionAssignmentValidationError(issues);
  }
}

function groupBy<T>(
  values: readonly T[],
  keySelector: (value: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keySelector(value);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [value]);
    else group.push(value);
  }
  return groups;
}

function addIssue(
  issues: AccountingDimensionAssignmentValidationIssue[],
  code: AccountingDimensionAssignmentValidationIssue["code"],
  dimensionTypeId: string | null,
  memberId: string | null,
  message: string,
): void {
  issues.push({ code, dimensionTypeId, memberId, message });
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}
