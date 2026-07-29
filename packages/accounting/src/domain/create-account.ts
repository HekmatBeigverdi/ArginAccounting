import type {
  Account,
  CreateAccountInput,
} from "./account.ts";
import {
  AccountValidationError,
} from "../validation/account-validation-error.ts";
import {
  validateAccount,
} from "../validation/validate-account.ts";

export function createAccount(
  input: CreateAccountInput,
): Account {
  const createdAt = input.createdAt.trim();

  const account: Account = {
    id: input.id.trim(),
    companyId: input.companyId.trim(),
    parentId: input.parentId?.trim() || null,

    level: input.level,
    code: input.code.trim(),
    name: input.name.trim(),
    englishName: input.englishName?.trim() || null,

    nature: input.nature,
    normalBalance: input.normalBalance,
    statementType: input.statementType,

    postingAllowed: input.postingAllowed ?? false,
    currencyEnabled: input.currencyEnabled ?? false,
    revaluationEnabled: input.revaluationEnabled ?? false,
    trackingEnabled: input.trackingEnabled ?? false,
    dueDateEnabled: input.dueDateEnabled ?? false,

    status: input.status ?? "active",
    displayOrder: input.displayOrder ?? 0,

    sourceType: input.sourceType ?? "manual",
    sourceReferenceId:
      input.sourceReferenceId?.trim() || null,

    createdAt,
    updatedAt: createdAt,
    version: 1,
  };

  const issues = validateAccount(account);

  if (issues.length > 0) {
    throw new AccountValidationError(issues);
  }

  return Object.freeze(account);
}
