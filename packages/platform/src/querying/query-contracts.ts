export const QUERY_PAGE_SIZE_DEFAULT = 50;
export const QUERY_PAGE_SIZE_MAXIMUM = 500;

export type QueryFilterOperator =
  | "equal"
  | "notEqual"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual"
  | "in"
  | "isNull"
  | "isNotNull";

export type QueryFilterValue =
  | string
  | number
  | boolean
  | Date
  | null;

export interface QueryFilter<
  TField extends string = string,
> {
  readonly field: TField;
  readonly operator: QueryFilterOperator;
  readonly value?:
    | QueryFilterValue
    | readonly QueryFilterValue[];
}

export type QuerySortDirection =
  | "ascending"
  | "descending";

export interface QuerySort<
  TField extends string = string,
> {
  readonly field: TField;
  readonly direction?: QuerySortDirection;
}

export interface PaginationRequest {
  readonly page?: number;
  readonly pageSize?: number;
}

export interface NormalizedPaginationRequest {
  readonly page: number;
  readonly pageSize: number;
  readonly offset: number;
}

export interface PagedResult<TItem> {
  readonly items: readonly TItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
  readonly hasPreviousPage: boolean;
  readonly hasNextPage: boolean;
}

export interface StructuredQuery<
  TField extends string = string,
> {
  readonly filters?: readonly QueryFilter<TField>[];
  readonly sorts?: readonly QuerySort<TField>[];
  readonly pagination?: PaginationRequest;
}

export interface QueryProjection<
  in TSource,
  out TResult,
> {
  project(source: TSource): TResult;
}

export type QueryProjectionFunction<TSource, TResult> = (
  source: TSource,
) => TResult;
