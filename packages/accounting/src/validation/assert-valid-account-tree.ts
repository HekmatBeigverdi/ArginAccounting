import type {
  Account,
} from "../domain/account.ts";
import type {
  AccountCodingSettings,
} from "../domain/account-coding-settings.ts";
import {
  AccountTreeValidationError,
} from "./account-tree-validation-error.ts";
import {
  validateAccountTree,
} from "./validate-account-tree.ts";

export function assertValidAccountTree(
  account: Account,
  parent: Account | null,
  settings: AccountCodingSettings,
): void {
  const issues = validateAccountTree(
    account,
    parent,
    settings,
  );

  if (issues.length > 0) {
    throw new AccountTreeValidationError(issues);
  }
}
