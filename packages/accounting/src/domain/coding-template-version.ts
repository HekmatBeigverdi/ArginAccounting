import { createCodingTemplateCode, type CodingTemplateCode } from "./coding-template-code.ts";
import {
  createCodingTemplateId,
  createCodingTemplateVersionId,
  type CodingTemplateId,
  type CodingTemplateVersionId,
} from "./coding-template-identity.ts";
import {
  createCodingTemplateName,
  type CodingTemplateName,
} from "./coding-template-name.ts";
import { CodingTemplateValidationError } from "./coding-template-validation-error.ts";
import type {
  CodingTemplateActivityType,
  CodingTemplateOwnership,
} from "./coding-template.ts";

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const sourceTypes: readonly CodingTemplateSourceType[] = [
  "catalog",
  "excel",
  "manual",
];

declare const codingTemplateVersionNumberBrand: unique symbol;

export type CodingTemplateVersionNumber = number & {
  readonly [codingTemplateVersionNumberBrand]: "CodingTemplateVersionNumber";
};

export type CodingTemplateSourceType = "catalog" | "excel" | "manual";

export interface CodingTemplateVersionSource {
  readonly type: CodingTemplateSourceType;
  readonly reference: string | null;
  readonly contractVersion: string;
  readonly contentFingerprint: string;
}

export interface CodingTemplateVersion {
  readonly id: CodingTemplateVersionId;
  readonly templateId: CodingTemplateId;
  readonly templateCode: CodingTemplateCode;
  readonly versionNumber: CodingTemplateVersionNumber;
  readonly persianName: CodingTemplateName;
  readonly englishName: CodingTemplateName | null;
  readonly activityType: CodingTemplateActivityType;
  readonly ownership: CodingTemplateOwnership;
  readonly source: Readonly<CodingTemplateVersionSource>;
  readonly publishedAt: string;
  readonly publishedBy: string;
}

export interface CreateCodingTemplateVersionInput {
  readonly id: string;
  readonly templateId: string;
  readonly templateCode: string;
  readonly versionNumber: number;
  readonly persianName: string;
  readonly englishName?: string | null;
  readonly activityType: CodingTemplateActivityType;
  readonly ownership: CodingTemplateOwnership;
  readonly source: CodingTemplateVersionSource;
  readonly publishedAt: string;
  readonly publishedBy: string;
}

export function createCodingTemplateVersionNumber(
  value: number,
): CodingTemplateVersionNumber {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new CodingTemplateValidationError(
      "version_invalid",
      "versionNumber",
      "شماره نسخه الگوی کدینگ باید یک عدد صحیح مثبت باشد.",
    );
  }

  return value as CodingTemplateVersionNumber;
}

function createVersionSource(
  source: CodingTemplateVersionSource,
): Readonly<CodingTemplateVersionSource> {
  const contractVersion = source.contractVersion.trim();
  const contentFingerprint = source.contentFingerprint.trim().toLowerCase();

  if (!sourceTypes.includes(source.type)) {
    throw new CodingTemplateValidationError(
      "source_type_invalid",
      "source.type",
      "نوع منبع نسخه الگوی کدینگ معتبر نیست.",
    );
  }

  if (contractVersion.length === 0) {
    throw new CodingTemplateValidationError(
      "contract_version_required",
      "source.contractVersion",
      "نسخه قرارداد منبع الگوی کدینگ الزامی است.",
    );
  }

  if (!SHA256_HEX_PATTERN.test(contentFingerprint)) {
    throw new CodingTemplateValidationError(
      "fingerprint_invalid",
      "source.contentFingerprint",
      "اثر انگشت محتوای نسخه باید SHA-256 با ۶۴ نویسه هگزادسیمال باشد.",
    );
  }

  return Object.freeze({
    type: source.type,
    reference: source.reference?.trim() || null,
    contractVersion,
    contentFingerprint,
  });
}

export function createCodingTemplateVersion(
  input: CreateCodingTemplateVersionInput,
): Readonly<CodingTemplateVersion> {
  const publishedBy = input.publishedBy.trim();

  if (publishedBy.length === 0) {
    throw new CodingTemplateValidationError(
      "identifier_required",
      "publishedBy",
      "شناسه منتشرکننده نسخه الزامی است.",
    );
  }

  return Object.freeze({
    id: createCodingTemplateVersionId(input.id),
    templateId: createCodingTemplateId(input.templateId),
    templateCode: createCodingTemplateCode(input.templateCode),
    versionNumber: createCodingTemplateVersionNumber(input.versionNumber),
    persianName: createCodingTemplateName(input.persianName, "fa"),
    englishName: input.englishName
      ? createCodingTemplateName(input.englishName, "en")
      : null,
    activityType: input.activityType,
    ownership: input.ownership,
    source: createVersionSource(input.source),
    publishedAt: input.publishedAt,
    publishedBy,
  });
}
