import type { CodingTemplateVersionContent } from "../domain/coding-template-items.ts";
import type { CodingTemplateVersion } from "../domain/coding-template-version.ts";

export interface CodingTemplateVersionRecord {
  readonly version: Readonly<CodingTemplateVersion>;
  readonly content: Readonly<CodingTemplateVersionContent>;
}

export type CodingTemplateApplicationStatus = "previewed" | "applied" | "rejected";

export interface CodingTemplateApplicationHistory {
  readonly id: string;
  readonly companyId: string;
  readonly templateId: string;
  readonly templateVersionId: string;
  readonly requestKey: string;
  readonly status: CodingTemplateApplicationStatus;
  readonly baselineFingerprint: string;
  readonly appliedAt: string | null;
  readonly actorId: string | null;
  readonly createdAt: string;
}

export type CodingTemplateImportStatus = "received" | "validated" | "rejected" | "published";

export interface CodingTemplateImportHistory {
  readonly id: string;
  readonly importKey: string;
  readonly fileName: string;
  readonly fileFingerprint: string;
  readonly contractVersion: string;
  readonly status: CodingTemplateImportStatus;
  readonly templateId: string | null;
  readonly templateVersionId: string | null;
  readonly actorId: string | null;
  readonly createdAt: string;
  readonly completedAt: string | null;
}
