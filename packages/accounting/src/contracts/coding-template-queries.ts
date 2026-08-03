import {
  InvalidQueryError,
  normalizePagination,
  normalizeQuerySorts,
  type NormalizedPaginationRequest,
  type PaginationRequest,
  type QuerySort,
  type QuerySortDirection,
} from "@argin/platform";
import type {
  CodingTemplateActivityType,
  CodingTemplateLifecycle,
  CodingTemplateOwnership,
} from "../domain/coding-template.ts";
import type {
  CodingTemplateApplicationStatus,
  CodingTemplateImportStatus,
} from "./coding-template-records.ts";

export type CodingTemplateSortField = "code" | "name" | "activityType" | "updatedAt" | "id";
export type CodingTemplateVersionSortField = "versionNumber" | "publishedAt" | "id";
export type CodingTemplateHistorySortField = "createdAt" | "status" | "id";

interface QueryPageAndSort<TField extends string> {
  readonly pagination?: PaginationRequest;
  readonly sorts?: readonly QuerySort<TField>[];
}

export interface CodingTemplateSearchQuery extends QueryPageAndSort<CodingTemplateSortField> {
  readonly text?: string;
  readonly activityType?: CodingTemplateActivityType;
  readonly ownership?: CodingTemplateOwnership;
  readonly lifecycle?: CodingTemplateLifecycle;
}

export interface CodingTemplateVersionSearchQuery
  extends QueryPageAndSort<CodingTemplateVersionSortField> {
  readonly templateId: string;
}

export interface CodingTemplateApplicationHistoryQuery
  extends QueryPageAndSort<CodingTemplateHistorySortField> {
  readonly companyId: string;
  readonly templateId?: string;
  readonly status?: CodingTemplateApplicationStatus;
}

export interface CodingTemplateImportHistoryQuery
  extends QueryPageAndSort<CodingTemplateHistorySortField> {
  readonly templateId?: string;
  readonly status?: CodingTemplateImportStatus;
}

export interface CodingTemplateRecommendationQuery {
  readonly companyId: string;
  readonly activityType: CodingTemplateActivityType;
  readonly includeCustom?: boolean;
}

export type NormalizedCodingTemplateSearchQuery = Omit<CodingTemplateSearchQuery, "pagination" | "sorts" | "text"> & {
  readonly text?: string;
  readonly pagination: NormalizedPaginationRequest;
  readonly sorts: readonly Required<QuerySort<CodingTemplateSortField>>[];
};
export type NormalizedCodingTemplateVersionSearchQuery = Omit<CodingTemplateVersionSearchQuery, "pagination" | "sorts"> & {
  readonly pagination: NormalizedPaginationRequest;
  readonly sorts: readonly Required<QuerySort<CodingTemplateVersionSortField>>[];
};
export type NormalizedCodingTemplateApplicationHistoryQuery = Omit<CodingTemplateApplicationHistoryQuery, "pagination" | "sorts"> & {
  readonly pagination: NormalizedPaginationRequest;
  readonly sorts: readonly Required<QuerySort<CodingTemplateHistorySortField>>[];
};
export type NormalizedCodingTemplateImportHistoryQuery = Omit<CodingTemplateImportHistoryQuery, "pagination" | "sorts"> & {
  readonly pagination: NormalizedPaginationRequest;
  readonly sorts: readonly Required<QuerySort<CodingTemplateHistorySortField>>[];
};

const templateSortFields = new Set<CodingTemplateSortField>(["code", "name", "activityType", "updatedAt", "id"]);
const versionSortFields = new Set<CodingTemplateVersionSortField>(["versionNumber", "publishedAt", "id"]);
const historySortFields = new Set<CodingTemplateHistorySortField>(["createdAt", "status", "id"]);

export function normalizeCodingTemplateSearchQuery(query: CodingTemplateSearchQuery): NormalizedCodingTemplateSearchQuery {
  return Object.freeze({
    ...optionalText(query.text),
    ...(query.activityType === undefined ? {} : { activityType: query.activityType }),
    ...(query.ownership === undefined ? {} : { ownership: query.ownership }),
    ...(query.lifecycle === undefined ? {} : { lifecycle: query.lifecycle }),
    pagination: normalizePagination(query.pagination),
    sorts: stableSort(normalizeQuerySorts(query.sorts ?? [{ field: "code" }], templateSortFields)),
  });
}

export function normalizeCodingTemplateVersionSearchQuery(query: CodingTemplateVersionSearchQuery): NormalizedCodingTemplateVersionSearchQuery {
  return Object.freeze({
    templateId: identifier(query.templateId, "templateId"),
    pagination: normalizePagination(query.pagination),
    sorts: stableSort(normalizeQuerySorts(query.sorts ?? [{ field: "versionNumber", direction: "descending" }], versionSortFields)),
  });
}

export function normalizeCodingTemplateApplicationHistoryQuery(query: CodingTemplateApplicationHistoryQuery): NormalizedCodingTemplateApplicationHistoryQuery {
  return Object.freeze({
    companyId: identifier(query.companyId, "companyId"),
    ...optionalIdentifier(query.templateId, "templateId"),
    ...(query.status === undefined ? {} : { status: query.status }),
    pagination: normalizePagination(query.pagination),
    sorts: stableSort(normalizeQuerySorts(query.sorts ?? [{ field: "createdAt", direction: "descending" }], historySortFields)),
  });
}

export function normalizeCodingTemplateImportHistoryQuery(query: CodingTemplateImportHistoryQuery): NormalizedCodingTemplateImportHistoryQuery {
  return Object.freeze({
    ...optionalIdentifier(query.templateId, "templateId"),
    ...(query.status === undefined ? {} : { status: query.status }),
    pagination: normalizePagination(query.pagination),
    sorts: stableSort(normalizeQuerySorts(query.sorts ?? [{ field: "createdAt", direction: "descending" }], historySortFields)),
  });
}

export function normalizeCodingTemplateRecommendationQuery(query: CodingTemplateRecommendationQuery): Readonly<CodingTemplateRecommendationQuery> {
  return Object.freeze({
    companyId: identifier(query.companyId, "companyId"),
    activityType: query.activityType,
    includeCustom: query.includeCustom ?? false,
  });
}

function stableSort<TField extends string>(sorts: readonly Required<QuerySort<TField>>[]): readonly Required<QuerySort<TField>>[] {
  return Object.freeze(sorts.some((sort) => sort.field === "id") ? [...sorts] : [
    ...sorts,
    { field: "id" as TField, direction: "ascending" as QuerySortDirection },
  ]);
}

function optionalText(value: string | undefined): { readonly text?: string } {
  const text = value?.trim();
  return text ? { text } : {};
}

function optionalIdentifier(value: string | undefined, field: string): { readonly [key: string]: string } {
  return value === undefined ? {} : { [field]: identifier(value, field) };
}

function identifier(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new InvalidQueryError(
      `accounting.coding-template-query.${field}-required`,
      `Coding template query ${field} is required.`,
      { field },
    );
  }
  return normalized;
}
