const MIN_ACCOUNT_CODE_LENGTH = 1;
const MAX_ACCOUNT_CODE_LENGTH = 30;
const ACCOUNT_CODE_PATTERN = /^[0-9]+$/;

declare const accountCodeBrand: unique symbol;

export type AccountCode = string & {
  readonly [accountCodeBrand]: "AccountCode";
};

export class AccountCodeValidationError extends Error {
  readonly value: string;

  constructor(value: string, message: string) {
    super(message);
    this.name = "AccountCodeValidationError";
    this.value = value;
  }
}

export function createAccountCode(value: string): AccountCode {
  const normalized = normalizeAccountCodeDigits(value.trim());

  if (normalized.length < MIN_ACCOUNT_CODE_LENGTH) {
    throw new AccountCodeValidationError(
      normalized,
      "کد حساب الزامی است.",
    );
  }

  if (normalized.length > MAX_ACCOUNT_CODE_LENGTH) {
    throw new AccountCodeValidationError(
      normalized,
      "کد حساب نمی‌تواند بیشتر از ۳۰ رقم باشد.",
    );
  }

  if (!ACCOUNT_CODE_PATTERN.test(normalized)) {
    throw new AccountCodeValidationError(
      normalized,
      "کد حساب فقط می‌تواند شامل ارقام انگلیسی باشد.",
    );
  }

  return normalized as AccountCode;
}

export function normalizeAccountCodeDigits(value: string): string {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0);

    if (codePoint === undefined) {
      return character;
    }

    if (codePoint >= 0x06f0 && codePoint <= 0x06f9) {
      return String(codePoint - 0x06f0);
    }

    if (codePoint >= 0x0660 && codePoint <= 0x0669) {
      return String(codePoint - 0x0660);
    }

    return character;
  }).join("");
}
