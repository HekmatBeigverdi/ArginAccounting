import {
  InvalidQueryError,
  normalizePagination,
  normalizeQuerySorts,
  type NormalizedPaginationRequest,
  type PaginationRequest,
  type QuerySort,
  type QuerySortDirection,
} from "@argin/platform";
import type { AccountDimensionRequirement } from "../domain/account-dimension-policy.ts";
import type { AccountingDimensionMemberStatus } from "../domain/accounting-dimension-member.ts";
import type { AccountingDimensionTypeStatus } from "../domain/accounting-dimension-type.ts";

export type AccountingDimensionTypeSortField =
  | "displayOrder"
  | "code"
  | "name"
  | "createdAt"
  | "id";

export type AccountingDimensionMemberSortField =
  | "displayOrder"
  | "code"
  | "name"
  | "validFrom"
  | "createdAt"
  | "id";

export type AccountDimensionPolicySortField =
  | "accountId"
  | "dimensionTypeId"
  | "requirement"
  | "createdAt"
  | "id";

export interface AccountingDimensionTypeSearchQuery {
  readonly companyId: string;
  readonly status?: AccountingDimensionTypeStatus;
  readonly text?: string;
  readonly pagination?: PaginationRequest;
  readonly sorts?: readonly QuerySort<AccountingDimensionTypeSortField>[];
}

export interface AccountingDimensionMemberSearchQuery {
  readonly companyId: string;
  readonly dimensionTypeId?: string;
  readonly status?: AccountingDimensionMemberStatus;
  readonly text?: string;
  readonly parentId?: string | null;
  readonly effectiveOn?: string;
  readonly pagination?: PaginationRequest;
  readonly sorts?: readonly QuerySort<AccountingDimensionMemberSortField>[];
}

export interface AccountDimensionPolicySearchQuery {
  readonly companyId: string;
  readonly accountId?: string;
  readonly dimensionTypeId?: string;
  readonly requirement?: AccountDimensionRequirement;
  readonly pagination?: PaginationRequest;
  readonly sorts?: readonly QuerySort<AccountDimensionPolicySortField>[];
}

export interface NormalizedAccountingDimensionTypeSearchQuery
  extends Omit<AccountingDimensionTypeSearchQuery, "pagination" | "sorts" | "text"> {
  readonly text?: string;
  readonly pagination: NormalizedPaginationRequest;
  readonly sorts: readonly Required<QuerySort<AccountingDimensionTypeSortField>>[];
}

export interface NormalizedAccountingDimensionMemberSearchQuery
  extends Omit<AccountingDimensionMemberSearchQuery, "pagination" | "sorts" | "text"> {
  readonly text?: string;
  readonly pagination: NormalizedPaginationRequest;
  readonly sorts: readonly Required<QuerySort<AccountingDimensionMemberSortField>>[];
}

export interface NormalizedAccountDimensionPolicySearchQuery
  extends Omit<AccountDimensionPolicySearchQuery, "pagination" | "sorts"> {
  readonly pagination: NormalizedPaginationRequest;
  readonly sorts: readonly Required<QuerySort<AccountDimensionPolicySortField>>[];
}

const typeSortFields = new Set<AccountingDimensionTypeSortField>([
  "displayOrder", "code", "name", "createdAt", "id",
]);
const memberSortFields = new Set<AccountingDimensionMemberSortField>([
  "displayOrder", "code", "name", "validFrom", "createdAt", "id",
]);
const policySortFields = new Set<AccountDimensionPolicySortField>([
  "accountId", "dimensionTypeId", "requirement", "createdAt", "id",
]);

export function normalizeAccountingDimensionTypeSearchQuery(
  query: AccountingDimensionTypeSearchQuery,
): NormalizedAccountingDimensionTypeSearchQuery {
  const companyId = requireIdentifier(query.companyId, "companyId");
  return Object.freeze({
    companyId,
    ...(query.status === undefined ? {} : { status: query.status }),
    ...normalizeText(query.text),
    pagination: normalizePagination(query.pagination),
    sorts: withStableIdSort(
      normalizeQuerySorts(
        query.sorts ?? [{ field: "displayOrder" }, { field: "code" }],
        typeSortFields,
      ),
    ),
  });
}

export function normalizeAccountingDimensionMemberSearchQuery(
  query: AccountingDimensionMemberSearchQuery,
): NormalizedAccountingDimensionMemberSearchQuery {
  const companyId = requireIdentifier(query.companyId, "companyId");
  const dimensionTypeId = normalizeIdentifier(query.dimensionTypeId, "dimensionTypeId");
  if (query.effectiveOn !== undefined && !isValidIsoDate(query.effectiveOn)) {
    throw new InvalidQueryError(
      "accounting.dimension-query.effective-date-invalid",
      "Dimension member effective date must use a valid YYYY-MM-DD value.",
      { effectiveOn: query.effectiveOn },
    );
  }
  return Object.freeze({
    companyId,
    ...(dimensionTypeId === undefined ? {} : { dimensionTypeId }),
    ...(query.status === undefined ? {} : { status: query.status }),
    ...normalizeText(query.text),
    ...(query.parentId === undefined
      ? {}
      : { parentId: query.parentId === null ? null : requireIdentifier(query.parentId, "parentId") }),
    ...(query.effectiveOn === undefined ? {} : { effectiveOn: query.effectiveOn }),
    pagination: normalizePagination(query.pagination),
    sorts: withStableIdSort(
      normalizeQuerySorts(
        query.sorts ?? [{ field: "displayOrder" }, { field: "code" }],
        memberSortFields,
      ),
    ),
  });
}

export function normalizeAccountDimensionPolicySearchQuery(
  query: AccountDimensionPolicySearchQuery,
): NormalizedAccountDimensionPolicySearchQuery {
  const companyId = requireIdentifier(query.companyId, "companyId");
  const accountId = normalizeIdentifier(query.accountId, "accountId");
  const dimensionTypeId = normalizeIdentifier(query.dimensionTypeId, "dimensionTypeId");
  return Object.freeze({
    companyId,
    ...(accountId === undefined ? {} : { accountId }),
    ...(dimensionTypeId === undefined ? {} : { dimensionTypeId }),
    ...(query.requirement === undefined ? {} : { requirement: query.requirement }),
    pagination: normalizePagination(query.pagination),
    sorts: withStableIdSort(
      normalizeQuerySorts(
        query.sorts ?? [{ field: "accountId" }, { field: "dimensionTypeId" }],
        policySortFields,
      ),
    ),
  });
}

function withStableIdSort<TField extends string>(
  sorts: readonly Required<QuerySort<TField>>[],
): readonly Required<QuerySort<TField>>[] {
  if (sorts.some((sort) => sort.field === "id")) return sorts;
  return Object.freeze([
    ...sorts,
    { field: "id" as TField, direction: "ascending" as QuerySortDirection },
  ]);
}

function normalizeText(text: string | undefined): { readonly text?: string } {
  const normalized = text?.trim();
  return normalized === undefined || normalized.length === 0 ? {} : { text: normalized };
}

function normalizeIdentifier(value: string | undefined, field: string): string | undefined {
  return value === undefined ? undefined : requireIdentifier(value, field);
}

function requireIdentifier(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new InvalidQueryError(
      `accounting.dimension-query.${field}-required`,
      `Dimension query ${field} is required.`,
      { field },
    );
  }
  return normalized;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
