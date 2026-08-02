import type {
  AccountingDimensionMember,
  CreateAccountingDimensionMemberInput,
} from "./accounting-dimension-member.ts";
import {
  AccountingDimensionMemberValidationError,
} from "../validation/accounting-dimension-member-validation-error.ts";
import {
  validateAccountingDimensionMember,
} from "../validation/validate-accounting-dimension-member.ts";

export function createAccountingDimensionMember(
  input: CreateAccountingDimensionMemberInput,
): AccountingDimensionMember {
  const createdAt = input.createdAt.trim();

  const member: AccountingDimensionMember = {
    id: input.id.trim(),
    companyId: input.companyId.trim(),
    dimensionTypeId: input.dimensionTypeId.trim(),

    code: normalizeDimensionMemberCode(input.code),
    name: input.name.trim(),
    englishName: input.englishName?.trim() || null,
    parentId: input.parentId?.trim() || null,

    status: input.status ?? "active",
    validFrom: input.validFrom?.trim() || null,
    validTo: input.validTo?.trim() || null,
    displayOrder: input.displayOrder ?? 0,

    source: input.source ?? "manual",
    sourceReferenceId:
      input.sourceReferenceId?.trim() || null,

    createdAt,
    updatedAt: createdAt,
    version: 1,
  };

  const issues =
    validateAccountingDimensionMember(member);

  if (issues.length > 0) {
    throw new AccountingDimensionMemberValidationError(
      issues,
    );
  }

  return Object.freeze(member);
}

export function normalizeDimensionMemberCode(
  value: string,
): string {
  return value.trim().toUpperCase();
}
