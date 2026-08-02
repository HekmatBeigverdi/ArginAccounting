import type {
  AccountDimensionPolicy,
  CreateAccountDimensionPolicyInput,
} from "./account-dimension-policy.ts";
import {
  AccountDimensionPolicyValidationError,
} from "../validation/account-dimension-policy-validation-error.ts";
import {
  validateAccountDimensionPolicy,
} from "../validation/validate-account-dimension-policy.ts";

export function createAccountDimensionPolicy(
  input: CreateAccountDimensionPolicyInput,
): AccountDimensionPolicy {
  const createdAt = input.createdAt.trim();

  const policy: AccountDimensionPolicy = {
    id: input.id.trim(),
    companyId: input.companyId.trim(),
    accountId: input.accountId.trim(),
    dimensionTypeId: input.dimensionTypeId.trim(),

    requirement: input.requirement,

    createdAt,
    updatedAt: createdAt,
    version: 1,
  };

  const issues = validateAccountDimensionPolicy(policy);

  if (issues.length > 0) {
    throw new AccountDimensionPolicyValidationError(
      issues,
    );
  }

  return Object.freeze(policy);
}
