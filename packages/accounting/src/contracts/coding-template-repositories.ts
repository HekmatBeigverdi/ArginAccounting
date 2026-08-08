import type { PagedResult } from "@argin/platform";
import type { CodingTemplate } from "../domain/coding-template.ts";
import type {
  CodingTemplateApplicationHistory,
  CodingTemplateApplicationItemMapping,
  CodingTemplateImportHistory,
  CodingTemplateVersionRecord,
} from "./coding-template-records.ts";
import type {
  CodingTemplateApplicationHistoryQuery,
  CodingTemplateImportHistoryQuery,
  CodingTemplateSearchQuery,
  CodingTemplateVersionSearchQuery,
} from "./coding-template-queries.ts";
import type { CodingTemplateCompanyBaseline } from "../application/coding-template-preview.ts";

export interface CodingTemplateRepository {
  create(template: Readonly<CodingTemplate>): Promise<void>;
  findById(id: string): Promise<Readonly<CodingTemplate> | null>;
  findByCode(code: string): Promise<Readonly<CodingTemplate> | null>;
  search(query: CodingTemplateSearchQuery): Promise<PagedResult<Readonly<CodingTemplate>>>;
  update(template: Readonly<CodingTemplate>): Promise<void>;
}

export interface CodingTemplateVersionRepository {
  create(record: CodingTemplateVersionRecord): Promise<void>;
  findById(id: string): Promise<CodingTemplateVersionRecord | null>;
  findByTemplateAndVersion(
    templateId: string,
    versionNumber: number,
  ): Promise<CodingTemplateVersionRecord | null>;
  search(
    query: CodingTemplateVersionSearchQuery,
  ): Promise<PagedResult<CodingTemplateVersionRecord>>;
}

export interface CodingTemplateApplicationHistoryRepository {
  create(history: CodingTemplateApplicationHistory): Promise<void>;
  findById(id: string): Promise<CodingTemplateApplicationHistory | null>;
  findByRequestKey(
    companyId: string,
    requestKey: string,
  ): Promise<CodingTemplateApplicationHistory | null>;
  search(
    query: CodingTemplateApplicationHistoryQuery,
  ): Promise<PagedResult<CodingTemplateApplicationHistory>>;
  update(history: CodingTemplateApplicationHistory): Promise<void>;
}

export interface CodingTemplateApplicationItemMappingRepository {
  createMany(mappings: readonly CodingTemplateApplicationItemMapping[]): Promise<void>;
  findByApplicationId(applicationId: string): Promise<readonly CodingTemplateApplicationItemMapping[]>;
}

export interface CodingTemplateCompanyBaselineRepository {
  read(companyId: string): Promise<Readonly<CodingTemplateCompanyBaseline>>;
}

export interface CodingTemplateImportHistoryRepository {
  create(history: CodingTemplateImportHistory): Promise<void>;
  findById(id: string): Promise<CodingTemplateImportHistory | null>;
  findByImportKey(importKey: string): Promise<CodingTemplateImportHistory | null>;
  search(
    query: CodingTemplateImportHistoryQuery,
  ): Promise<PagedResult<CodingTemplateImportHistory>>;
  update(history: CodingTemplateImportHistory): Promise<void>;
}
