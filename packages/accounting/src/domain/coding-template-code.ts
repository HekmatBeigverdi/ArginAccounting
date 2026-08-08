import { CodingTemplateValidationError } from "./coding-template-validation-error.ts";

const MAX_CODE_LENGTH = 64;
const CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEPARATOR_PATTERN = /[\s_]+/gu;
const REPEATED_HYPHEN_PATTERN = /-+/gu;

declare const codingTemplateCodeBrand: unique symbol;

export type CodingTemplateCode = string & {
  readonly [codingTemplateCodeBrand]: "CodingTemplateCode";
};

export function normalizeCodingTemplateCode(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(SEPARATOR_PATTERN, "-")
    .replace(REPEATED_HYPHEN_PATTERN, "-");
}

export function createCodingTemplateCode(value: string): CodingTemplateCode {
  const normalized = normalizeCodingTemplateCode(value);

  if (normalized.length === 0) {
    throw new CodingTemplateValidationError(
      "code_required",
      "code",
      "کد پایدار الگوی کدینگ الزامی است.",
    );
  }

  if (normalized.length > MAX_CODE_LENGTH) {
    throw new CodingTemplateValidationError(
      "code_too_long",
      "code",
      "کد الگوی کدینگ نمی‌تواند بیشتر از ۶۴ نویسه باشد.",
    );
  }

  if (!CODE_PATTERN.test(normalized)) {
    throw new CodingTemplateValidationError(
      "code_invalid",
      "code",
      "کد الگو فقط می‌تواند شامل حروف کوچک انگلیسی، رقم و خط تیره باشد.",
    );
  }

  return normalized as CodingTemplateCode;
}
