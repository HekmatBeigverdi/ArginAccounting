const MAX_ACCOUNT_NAME_LENGTH = 200;
const INTERNAL_WHITESPACE_PATTERN = /\s+/gu;

declare const accountNameBrand: unique symbol;

export type AccountName = string & {
  readonly [accountNameBrand]: "AccountName";
};

export class AccountNameValidationError extends Error {
  readonly value: string;

  constructor(value: string, message: string) {
    super(message);
    this.name = "AccountNameValidationError";
    this.value = value;
  }
}

export function createAccountName(value: string): AccountName {
  const normalized = normalizeAccountName(value);

  if (normalized.length === 0) {
    throw new AccountNameValidationError(
      normalized,
      "عنوان حساب الزامی است.",
    );
  }

  if (normalized.length > MAX_ACCOUNT_NAME_LENGTH) {
    throw new AccountNameValidationError(
      normalized,
      "عنوان حساب نمی‌تواند بیشتر از ۲۰۰ نویسه باشد.",
    );
  }

  return normalized as AccountName;
}

export function normalizeAccountName(value: string): string {
  return value
    .trim()
    .replace(INTERNAL_WHITESPACE_PATTERN, " ");
}
