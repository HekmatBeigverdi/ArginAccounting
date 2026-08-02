import { CodingTemplateValidationError } from "./coding-template-validation-error.ts";

const MAX_NAME_LENGTH = 200;
const INTERNAL_WHITESPACE_PATTERN = /\s+/gu;

declare const codingTemplateNameBrand: unique symbol;

export type CodingTemplateName = string & {
  readonly [codingTemplateNameBrand]: "CodingTemplateName";
};

export function normalizeCodingTemplateName(value: string): string {
  return value.trim().replace(INTERNAL_WHITESPACE_PATTERN, " ");
}

export function createCodingTemplateName(
  value: string,
  locale: "fa" | "en",
): CodingTemplateName {
  const normalized = normalizeCodingTemplateName(value);

  if (locale === "fa" && normalized.length === 0) {
    throw new CodingTemplateValidationError(
      "persian_name_required",
      "persianName",
      "عنوان فارسی الگوی کدینگ الزامی است.",
    );
  }

  if (normalized.length > MAX_NAME_LENGTH) {
    throw new CodingTemplateValidationError(
      "name_too_long",
      locale === "fa" ? "persianName" : "englishName",
      "عنوان الگوی کدینگ نمی‌تواند بیشتر از ۲۰۰ نویسه باشد.",
    );
  }

  return normalized as CodingTemplateName;
}
