import { InvalidQueryError } from "./query-errors.ts";
import {
  QUERY_PAGE_SIZE_DEFAULT,
  QUERY_PAGE_SIZE_MAXIMUM,
  type NormalizedPaginationRequest,
  type PaginationRequest,
  type QueryFilter,
  type QueryFilterOperator,
  type QueryFilterValue,
  type QuerySort,
  type QuerySortDirection,
} from "./query-contracts.ts";

const filterOperators = new Set<QueryFilterOperator>([
  "equal",
  "notEqual",
  "contains",
  "startsWith",
  "endsWith",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual",
  "in",
  "isNull",
  "isNotNull",
]);

const valueLessOperators = new Set<QueryFilterOperator>([
  "isNull",
  "isNotNull",
]);

const sortDirections = new Set<QuerySortDirection>([
  "ascending",
  "descending",
]);

export function normalizePagination(
  request: PaginationRequest = {},
): NormalizedPaginationRequest {
  const page = request.page ?? 1;
  const pageSize =
    request.pageSize ?? QUERY_PAGE_SIZE_DEFAULT;

  assertPositiveInteger(page, "page");
  assertPositiveInteger(pageSize, "pageSize");

  if (pageSize > QUERY_PAGE_SIZE_MAXIMUM) {
    throw new InvalidQueryError(
      "query.page-size-too-large",
      `Query page size cannot exceed ${QUERY_PAGE_SIZE_MAXIMUM}.`,
      {
        pageSize,
        maximum: QUERY_PAGE_SIZE_MAXIMUM,
      },
    );
  }

  const offset = (page - 1) * pageSize;

  if (!Number.isSafeInteger(offset)) {
    throw new InvalidQueryError(
      "query.pagination-overflow",
      "Query pagination offset exceeds the safe integer range.",
      { page, pageSize },
    );
  }

  return Object.freeze({ page, pageSize, offset });
}

export function normalizeQueryFilters<
  TField extends string,
>(
  filters: readonly QueryFilter<TField>[] = [],
  allowedFields?: ReadonlySet<TField>,
): readonly QueryFilter<TField>[] {
  return Object.freeze(
    filters.map((filter, index) => {
      const field = normalizeField(
        filter.field,
        "filter",
        index,
        allowedFields,
      );

      if (!filterOperators.has(filter.operator)) {
        throw new InvalidQueryError(
          "query.filter-operator-invalid",
          `Unsupported query filter operator "${String(filter.operator)}".`,
          { operator: filter.operator, index },
        );
      }

      const requiresNoValue =
        valueLessOperators.has(filter.operator);

      if (
        requiresNoValue &&
        filter.value !== undefined
      ) {
        throw new InvalidQueryError(
          "query.filter-value-not-allowed",
          `Query filter operator "${filter.operator}" does not accept a value.`,
          { field, operator: filter.operator, index },
        );
      }

      if (
        !requiresNoValue &&
        filter.value === undefined
      ) {
        throw new InvalidQueryError(
          "query.filter-value-required",
          `Query filter operator "${filter.operator}" requires a value.`,
          { field, operator: filter.operator, index },
        );
      }

      const value = normalizeFilterValue(
        filter.value,
        filter.operator,
        index,
      );

      return Object.freeze({
        field,
        operator: filter.operator,
        ...(value === undefined ? {} : { value }),
      });
    }),
  );
}

export function normalizeQuerySorts<
  TField extends string,
>(
  sorts: readonly QuerySort<TField>[] = [],
  allowedFields?: ReadonlySet<TField>,
): readonly Required<QuerySort<TField>>[] {
  const fields = new Set<TField>();

  return Object.freeze(
    sorts.map((sort, index) => {
      const field = normalizeField(
        sort.field,
        "sort",
        index,
        allowedFields,
      );
      const direction =
        sort.direction ?? "ascending";

      if (!sortDirections.has(direction)) {
        throw new InvalidQueryError(
          "query.sort-direction-invalid",
          `Unsupported query sort direction "${String(direction)}".`,
          { direction, index },
        );
      }

      if (fields.has(field)) {
        throw new InvalidQueryError(
          "query.sort-field-duplicate",
          `Query sort field "${field}" is duplicated.`,
          { field, index },
        );
      }

      fields.add(field);
      return Object.freeze({ field, direction });
    }),
  );
}

function assertPositiveInteger(
  value: number,
  field: "page" | "pageSize",
): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new InvalidQueryError(
      `query.${field}-invalid`,
      `Query ${field} must be a positive safe integer.`,
      { [field]: value },
    );
  }
}

function normalizeField<TField extends string>(
  value: TField,
  target: "filter" | "sort",
  index: number,
  allowedFields?: ReadonlySet<TField>,
): TField {
  const normalized = value.trim() as TField;

  if (normalized.length === 0) {
    throw new InvalidQueryError(
      `query.${target}-field-required`,
      `Query ${target} field is required.`,
      { index },
    );
  }

  if (
    allowedFields !== undefined &&
    !allowedFields.has(normalized)
  ) {
    throw new InvalidQueryError(
      `query.${target}-field-not-allowed`,
      `Query ${target} field "${normalized}" is not allowed.`,
      { field: normalized, index },
    );
  }

  return normalized;
}

function normalizeFilterValue(
  value:
    | QueryFilterValue
    | readonly QueryFilterValue[]
    | undefined,
  operator: QueryFilterOperator,
  index: number,
):
  | QueryFilterValue
  | readonly QueryFilterValue[]
  | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (operator === "in") {
    if (!Array.isArray(value) || value.length === 0) {
      throw new InvalidQueryError(
        "query.filter-in-values-required",
        'Query filter operator "in" requires a non-empty value array.',
        { index },
      );
    }

    return Object.freeze(value.map(cloneFilterValue));
  }

  if (Array.isArray(value)) {
    throw new InvalidQueryError(
      "query.filter-array-not-allowed",
      `Query filter operator "${operator}" does not accept an array.`,
      { index, operator },
    );
  }

  return cloneFilterValue(value as QueryFilterValue);
}

function cloneFilterValue(
  value: QueryFilterValue,
): QueryFilterValue {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new InvalidQueryError(
        "query.filter-date-invalid",
        "Query filter date must be valid.",
      );
    }

    return new Date(value.getTime());
  }

  if (
    typeof value === "number" &&
    !Number.isFinite(value)
  ) {
    throw new InvalidQueryError(
      "query.filter-number-invalid",
      "Query filter number must be finite.",
    );
  }

  return value;
}
