import type {
  Account,
  AccountLevel,
} from "../domain/account.ts";
import type {
  AccountCodingSettings,
} from "../domain/account-coding-settings.ts";
import type {
  AccountTreeValidationIssue,
} from "./account-tree-validation-error.ts";

const EXPECTED_PARENT_LEVEL: Readonly<
  Partial<Record<AccountLevel, AccountLevel>>
> = Object.freeze({
  general: "group",
  subsidiary: "general",
});

export function validateAccountTree(
  account: Account,
  parent: Account | null,
  settings: AccountCodingSettings,
): readonly AccountTreeValidationIssue[] {
  const issues: AccountTreeValidationIssue[] = [];

  validateSettingsCompany(account, settings, issues);
  validateCodeLength(account, settings, issues);

  if (account.level === "group") {
    validateGroupParent(account, parent, issues);
  } else {
    validateRequiredParent(account, parent, issues);
  }

  if (parent !== null) {
    validateParentIdentity(account, parent, issues);
    validateParentCompany(account, parent, issues);
    validateParentLevel(account, parent, issues);

    if (settings.enforceHierarchicalCodes) {
      validateCodePrefix(account, parent, issues);
    }
  }

  return Object.freeze(issues);
}

function validateSettingsCompany(
  account: Account,
  settings: AccountCodingSettings,
  issues: AccountTreeValidationIssue[],
): void {
  if (account.companyId !== settings.companyId) {
    issues.push({
      field: "companyId",
      message:
        "تنظیمات کدینگ باید متعلق به شرکت حساب باشد.",
    });
  }
}

function validateCodeLength(
  account: Account,
  settings: AccountCodingSettings,
  issues: AccountTreeValidationIssue[],
): void {
  const expectedLength = {
    group: settings.groupCodeLength,
    general: settings.generalCodeLength,
    subsidiary: settings.subsidiaryCodeLength,
  }[account.level];

  if (account.code.length !== expectedLength) {
    issues.push({
      field: "code",
      message:
        `طول کد حساب سطح ${account.level} باید دقیقاً ` +
        `${expectedLength} رقم باشد.`,
    });
  }
}

function validateGroupParent(
  account: Account,
  parent: Account | null,
  issues: AccountTreeValidationIssue[],
): void {
  if (account.parentId !== null || parent !== null) {
    issues.push({
      field: "parentId",
      message: "حساب گروه نمی‌تواند والد داشته باشد.",
    });
  }
}

function validateRequiredParent(
  account: Account,
  parent: Account | null,
  issues: AccountTreeValidationIssue[],
): void {
  if (account.parentId === null || parent === null) {
    issues.push({
      field: "parentId",
      message:
        "حساب کل و معین باید والد معتبر داشته باشند.",
    });
  }
}

function validateParentIdentity(
  account: Account,
  parent: Account,
  issues: AccountTreeValidationIssue[],
): void {
  if (account.parentId !== parent.id) {
    issues.push({
      field: "parentId",
      message:
        "شناسه والد حساب با حساب والد ارائه‌شده یکسان نیست.",
    });
  }
}

function validateParentCompany(
  account: Account,
  parent: Account,
  issues: AccountTreeValidationIssue[],
): void {
  if (account.companyId !== parent.companyId) {
    issues.push({
      field: "companyId",
      message: "حساب والد و فرزند باید متعلق به یک شرکت باشند.",
    });
  }
}

function validateParentLevel(
  account: Account,
  parent: Account,
  issues: AccountTreeValidationIssue[],
): void {
  const expectedLevel = EXPECTED_PARENT_LEVEL[account.level];

  if (
    expectedLevel !== undefined &&
    parent.level !== expectedLevel
  ) {
    issues.push({
      field: "level",
      message:
        `والد حساب سطح ${account.level} باید در سطح ` +
        `${expectedLevel} باشد.`,
    });
  }
}

function validateCodePrefix(
  account: Account,
  parent: Account,
  issues: AccountTreeValidationIssue[],
): void {
  if (!account.code.startsWith(parent.code)) {
    issues.push({
      field: "code",
      message:
        "در کدینگ سلسله‌مراتبی، کد فرزند باید با کد والد شروع شود.",
    });
  }
}
