import type {
  QueryProjection,
  QueryProjectionFunction,
} from "./query-contracts.ts";

export function applyProjection<TSource, TResult>(
  source: TSource,
  projection:
    | QueryProjection<TSource, TResult>
    | QueryProjectionFunction<TSource, TResult>,
): TResult {
  return typeof projection === "function"
    ? projection(source)
    : projection.project(source);
}

export function applyProjectionToMany<
  TSource,
  TResult,
>(
  source: readonly TSource[],
  projection:
    | QueryProjection<TSource, TResult>
    | QueryProjectionFunction<TSource, TResult>,
): readonly TResult[] {
  return Object.freeze(
    source.map((item) =>
      applyProjection(item, projection),
    ),
  );
}
