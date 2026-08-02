import { createCodingTemplateCode, type CodingTemplateCode } from "./coding-template-code.ts";
import { createCodingTemplateId, type CodingTemplateId } from "./coding-template-identity.ts";
import {
  createCodingTemplateName,
  type CodingTemplateName,
} from "./coding-template-name.ts";
import { CodingTemplateValidationError } from "./coding-template-validation-error.ts";
import type {
  CodingTemplateVersion,
  CreateCodingTemplateVersionInput,
} from "./coding-template-version.ts";
import { createCodingTemplateVersion } from "./coding-template-version.ts";

export type CodingTemplateActivityType =
  | "service"
  | "trading"
  | "manufacturing"
  | "custom";

export type CodingTemplateOwnership = "built_in" | "custom";
export type CodingTemplateLifecycle = "draft" | "published" | "retired";

const activityTypes: readonly CodingTemplateActivityType[] = [
  "service",
  "trading",
  "manufacturing",
  "custom",
];
const ownershipTypes: readonly CodingTemplateOwnership[] = [
  "built_in",
  "custom",
];

export interface CodingTemplate {
  readonly id: CodingTemplateId;
  readonly code: CodingTemplateCode;
  readonly persianName: CodingTemplateName;
  readonly englishName: CodingTemplateName | null;
  readonly activityType: CodingTemplateActivityType;
  readonly ownership: CodingTemplateOwnership;
  readonly lifecycle: CodingTemplateLifecycle;
  readonly latestPublishedVersion: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly optimisticVersion: number;
}

export interface CreateCodingTemplateInput {
  readonly id: string;
  readonly code: string;
  readonly persianName: string;
  readonly englishName?: string | null;
  readonly activityType: CodingTemplateActivityType;
  readonly ownership: CodingTemplateOwnership;
  readonly createdAt: string;
}

export interface PublishCodingTemplateInput
  extends Omit<
    CreateCodingTemplateVersionInput,
    | "templateId"
    | "templateCode"
    | "persianName"
    | "englishName"
    | "activityType"
    | "ownership"
    | "versionNumber"
  > {}

export interface PublishCodingTemplateResult {
  readonly template: Readonly<CodingTemplate>;
  readonly version: Readonly<CodingTemplateVersion>;
}

export function createCodingTemplate(
  input: CreateCodingTemplateInput,
): Readonly<CodingTemplate> {
  if (!activityTypes.includes(input.activityType)) {
    throw new CodingTemplateValidationError(
      "activity_type_invalid",
      "activityType",
      "نوع فعالیت الگوی کدینگ معتبر نیست.",
    );
  }

  if (!ownershipTypes.includes(input.ownership)) {
    throw new CodingTemplateValidationError(
      "ownership_invalid",
      "ownership",
      "نوع مالکیت الگوی کدینگ معتبر نیست.",
    );
  }

  return Object.freeze({
    id: createCodingTemplateId(input.id),
    code: createCodingTemplateCode(input.code),
    persianName: createCodingTemplateName(input.persianName, "fa"),
    englishName: input.englishName
      ? createCodingTemplateName(input.englishName, "en")
      : null,
    activityType: input.activityType,
    ownership: input.ownership,
    lifecycle: "draft",
    latestPublishedVersion: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    optimisticVersion: 1,
  });
}

export function publishCodingTemplate(
  template: Readonly<CodingTemplate>,
  input: PublishCodingTemplateInput,
): PublishCodingTemplateResult {
  if (template.lifecycle === "retired") {
    throw new CodingTemplateValidationError(
      "invalid_lifecycle_transition",
      "lifecycle",
      "الگوی بازنشسته‌شده قابل انتشار نیست.",
    );
  }

  const versionNumber = (template.latestPublishedVersion ?? 0) + 1;
  const version = createCodingTemplateVersion({
    ...input,
    templateId: template.id,
    templateCode: template.code,
    versionNumber,
    persianName: template.persianName,
    englishName: template.englishName,
    activityType: template.activityType,
    ownership: template.ownership,
  });

  return {
    template: Object.freeze({
      ...template,
      lifecycle: "published",
      latestPublishedVersion: versionNumber,
      updatedAt: input.publishedAt,
      optimisticVersion: template.optimisticVersion + 1,
    }),
    version,
  };
}

export function retireCodingTemplate(
  template: Readonly<CodingTemplate>,
  retiredAt: string,
): Readonly<CodingTemplate> {
  if (
    template.lifecycle !== "published" ||
    template.latestPublishedVersion === null
  ) {
    throw new CodingTemplateValidationError(
      "published_version_required",
      "lifecycle",
      "فقط الگوی دارای نسخه منتشرشده قابل بازنشستگی است.",
    );
  }

  return Object.freeze({
    ...template,
    lifecycle: "retired",
    updatedAt: retiredAt,
    optimisticVersion: template.optimisticVersion + 1,
  });
}
