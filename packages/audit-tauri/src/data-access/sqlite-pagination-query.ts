import type {
  SqliteDatabase
} from "../database";

import {
  normalizePagination,
  normalizeTotalCount,
  type PaginationOptions
} from "./pagination";

export interface SqlitePaginationQueryOptions<
  TRow,
  TItem
> {
  database: SqliteDatabase;

  countSql: string;
  selectSql: string;

  parameters?: readonly unknown[];

  offset?: number;
  limit?: number;

  pagination?: PaginationOptions;

  mapRow(
    row: TRow
  ): TItem;
}

export interface SqlitePaginationResult<T> {
  items: T[];
  totalCount: number;
  offset: number;
  limit: number;
}

interface CountRow {
  total_count:
    | number
    | string
    | bigint;
}

export async function executeSqlitePaginationQuery<
  TRow,
  TItem
>(
  options:
    SqlitePaginationQueryOptions<
      TRow,
      TItem
    >
): Promise<
  SqlitePaginationResult<TItem>
> {
  const {
    offset,
    limit
  } = normalizePagination(
    options.offset,
    options.limit,
    options.pagination
  );

  const parameters = [
    ...(options.parameters ?? [])
  ];

  const countRows =
    await options.database.select<
      CountRow[]
    >(
      options.countSql,
      parameters
    );

  const totalCount =
    normalizeTotalCount(
      countRows[0]?.total_count
    );

  if (
    totalCount === 0 ||
    offset >= totalCount
  ) {
    return {
      items: [],
      totalCount,
      offset,
      limit
    };
  }

  const rows =
    await options.database.select<
      TRow[]
    >(
      options.selectSql,
      [
        ...parameters,
        limit,
        offset
      ]
    );

  return {
    items: rows.map(
      options.mapRow
    ),
    totalCount,
    offset,
    limit
  };
}
