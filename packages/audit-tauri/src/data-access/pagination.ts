export interface PaginationOptions {
  defaultLimit?: number;
  maximumLimit?: number;
}

export interface NormalizedPagination {
  offset: number;
  limit: number;
}

const FALLBACK_DEFAULT_LIMIT = 50;
const FALLBACK_MAXIMUM_LIMIT = 200;

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number
): number {
  if (
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  return Math.max(
    1,
    Math.trunc(value)
  );
}

export function normalizePagination(
  offset: number | undefined,
  limit: number | undefined,
  options: PaginationOptions = {}
): NormalizedPagination {
  const defaultLimit =
    normalizePositiveInteger(
      options.defaultLimit,
      FALLBACK_DEFAULT_LIMIT
    );

  const maximumLimit =
    Math.max(
      defaultLimit,
      normalizePositiveInteger(
        options.maximumLimit,
        FALLBACK_MAXIMUM_LIMIT
      )
    );

  const normalizedOffset =
    offset === undefined ||
    !Number.isFinite(offset)
      ? 0
      : Math.max(
          0,
          Math.trunc(offset)
        );

  const normalizedLimit =
    limit === undefined ||
    !Number.isFinite(limit)
      ? defaultLimit
      : Math.min(
          maximumLimit,
          Math.max(
            1,
            Math.trunc(limit)
          )
        );

  return {
    offset: normalizedOffset,
    limit: normalizedLimit
  };
}

export function normalizeTotalCount(
  value:
    | number
    | string
    | bigint
    | null
    | undefined
): number {
  if (typeof value === "bigint") {
    if (value <= 0n) {
      return 0;
    }

    return value >
      BigInt(Number.MAX_SAFE_INTEGER)
      ? Number.MAX_SAFE_INTEGER
      : Number(value);
  }

  const parsedValue =
    Number(value ?? 0);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue <= 0
  ) {
    return 0;
  }

  return Math.min(
    Number.MAX_SAFE_INTEGER,
    Math.trunc(parsedValue)
  );
}
