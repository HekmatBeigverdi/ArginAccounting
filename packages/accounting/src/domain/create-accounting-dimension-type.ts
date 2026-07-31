import type {
  AccountingDimensionType,
  CreateAccountingDimensionTypeInput,
} from "./accounting-dimension-type.ts";
import {
  AccountingDimensionTypeValidationError,
} from "../validation/accounting-dimension-type-validation-error.ts";
import {
  validateAccountingDimensionType,
} from "../validation/validate-accounting-dimension-type.ts";

export function createAccountingDimensionType(
  input: CreateAccountingDimensionTypeInput,
): AccountingDimensionType {
  const createdAt = input.createdAt.trim();

  const dimensionType: AccountingDimensionType = {
    id: input.id.trim(),
    companyId: input.companyId.trim(),

    code: normalizeDimensionTypeCode(input.code),
    name: input.name.trim(),
    englishName: input.englishName?.trim() || null,

    hierarchical: input.hierarchical ?? false,
    allowMultipleMembers:
      input.allowMultipleMembers ?? false,
    status: input.status ?? "active",
    displayOrder: input.displayOrder ?? 0,

    source: input.source ?? "manual",
    sourceReferenceId:
      input.sourceReferenceId?.trim() || null,

    createdAt,
    updatedAt: createdAt,
    version: 1,
  };

  const issues =
    validateAccountingDimensionType(dimensionType);

  if (issues.length > 0) {
    throw new AccountingDimensionTypeValidationError(
      issues,
    );
  }

  return Object.freeze(dimensionType);
}

export function normalizeDimensionTypeCode(
  value: string,
): string {
  return value.trim().toUpperCase();
}
