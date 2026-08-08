import { CodingTemplateValidationError } from "./coding-template-validation-error.ts";

const MAX_IDENTIFIER_LENGTH = 128;

declare const codingTemplateIdBrand: unique symbol;
declare const codingTemplateVersionIdBrand: unique symbol;

export type CodingTemplateId = string & {
  readonly [codingTemplateIdBrand]: "CodingTemplateId";
};

export type CodingTemplateVersionId = string & {
  readonly [codingTemplateVersionIdBrand]: "CodingTemplateVersionId";
};

function createIdentifier(value: string, field: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new CodingTemplateValidationError(
      "identifier_required",
      field,
      "شناسه الگوی کدینگ الزامی است.",
    );
  }

  if (normalized.length > MAX_IDENTIFIER_LENGTH) {
    throw new CodingTemplateValidationError(
      "identifier_too_long",
      field,
      "شناسه الگوی کدینگ نمی‌تواند بیشتر از ۱۲۸ نویسه باشد.",
    );
  }

  return normalized;
}

export function createCodingTemplateId(value: string): CodingTemplateId {
  return createIdentifier(value, "id") as CodingTemplateId;
}

export function createCodingTemplateVersionId(
  value: string,
): CodingTemplateVersionId {
  return createIdentifier(value, "versionId") as CodingTemplateVersionId;
}
