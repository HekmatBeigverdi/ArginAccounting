import { InvalidQueryError } from "./query-errors.ts";
import {
  type NormalizedPaginationRequest,
  type PagedResult,
} from "./query-contracts.ts";

export function createPagedResult<TItem>(
  items: readonly TItem[],
  totalItems: number,
  pagination: NormalizedPaginationRequest,
): PagedResult<TItem> {
  if (
    !Number.isSafeInteger(totalItems) ||
    totalItems < 0
  ) {
    throw new InvalidQueryError(
      "query.total-items-invalid",
      "Query total items must be a non-negative safe integer.",
      { totalItems },
    );
  }

  if (items.length > pagination.pageSize) {
    throw new InvalidQueryError(
      "query.page-items-too-many",
      "Query page contains more items than its page size.",
      {
        itemCount: items.length,
        pageSize: pagination.pageSize,
      },
    );
  }

  const totalPages =
    totalItems === 0
      ? 0
      : Math.ceil(totalItems / pagination.pageSize);

  return Object.freeze({
    items: Object.freeze([...items]),
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalItems,
    totalPages,
    hasPreviousPage:
      pagination.page > 1 && totalPages > 0,
    hasNextPage: pagination.page < totalPages,
  });
}
