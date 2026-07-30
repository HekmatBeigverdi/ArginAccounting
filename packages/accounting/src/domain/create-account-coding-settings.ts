import type {
  AccountCodingSettings,
  CreateAccountCodingSettingsInput,
} from "./account-coding-settings.ts";
import {
  DEFAULT_ACCOUNT_CODE_LENGTHS,
} from "./account-coding-settings.ts";
import {
  AccountCodingSettingsValidationError,
} from "../validation/account-coding-settings-validation-error.ts";
import {
  validateAccountCodingSettings,
} from "../validation/validate-account-coding-settings.ts";

export function createAccountCodingSettings(
  input: CreateAccountCodingSettingsInput,
): AccountCodingSettings {
  const settings: AccountCodingSettings = {
    companyId: input.companyId.trim(),
    groupCodeLength:
      input.groupCodeLength ??
      DEFAULT_ACCOUNT_CODE_LENGTHS.group,
    generalCodeLength:
      input.generalCodeLength ??
      DEFAULT_ACCOUNT_CODE_LENGTHS.general,
    subsidiaryCodeLength:
      input.subsidiaryCodeLength ??
      DEFAULT_ACCOUNT_CODE_LENGTHS.subsidiary,
    enforceHierarchicalCodes:
      input.enforceHierarchicalCodes ?? true,
    allowCodeChangeAfterUse:
      input.allowCodeChangeAfterUse ?? false,
    version: 1,
  };

  const issues = validateAccountCodingSettings(settings);

  if (issues.length > 0) {
    throw new AccountCodingSettingsValidationError(issues);
  }

  return Object.freeze(settings);
}
