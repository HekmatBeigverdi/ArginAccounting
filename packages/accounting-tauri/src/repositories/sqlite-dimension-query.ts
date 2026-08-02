import type { DatabaseSession, DatabaseValue } from "@argin/database";

export interface SqlitePage<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
  readonly hasPreviousPage: boolean;
  readonly hasNextPage: boolean;
}

export async function queryPage<TRow, TItem>(
  database: DatabaseSession,
  table: string,
  where: readonly string[],
  parameters: readonly DatabaseValue[],
  orderBy: string,
  pagination: { readonly page: number; readonly pageSize: number; readonly offset: number },
  map: (row: TRow) => TItem,
): Promise<SqlitePage<TItem>> {
  const clause = where.length === 0 ? "" : ` WHERE ${where.join(" AND ")}`;
  const count = await database.queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM ${table}${clause}`,
    parameters,
  );
  const totalItems = count?.total ?? 0;
  const rows = await database.query<TRow>(
    `SELECT * FROM ${table}${clause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...parameters, pagination.pageSize, pagination.offset],
  );
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pagination.pageSize);
  return Object.freeze({
    items: Object.freeze(rows.map(map)), page: pagination.page,
    pageSize: pagination.pageSize, totalItems, totalPages,
    hasPreviousPage: pagination.page > 1 && totalPages > 0,
    hasNextPage: pagination.page < totalPages,
  });
}

export function sqlOrderBy<T extends string>(
  sorts: readonly { readonly field: T; readonly direction: "ascending" | "descending" }[],
  columns: Readonly<Record<T, string>>,
): string {
  return sorts.map(({ field, direction }) =>
    `${columns[field]} ${direction === "ascending" ? "ASC" : "DESC"}`
  ).join(", ");
}
