import type { PlatformError } from "./platform-error.ts";

export type Success<T> = Readonly<{
  ok: true;
  value: T;
}>;

export type Failure<E extends PlatformError = PlatformError> = Readonly<{
  ok: false;
  error: E;
}>;

export type Result<
  T,
  E extends PlatformError = PlatformError,
> = Success<T> | Failure<E>;

export function success<T>(value: T): Success<T> {
  return {
    ok: true,
    value,
  };
}

export function failure<E extends PlatformError>(
  error: E,
): Failure<E> {
  return {
    ok: false,
    error,
  };
}

export function isSuccess<T, E extends PlatformError>(
  result: Result<T, E>,
): result is Success<T> {
  return result.ok;
}

export function isFailure<T, E extends PlatformError>(
  result: Result<T, E>,
): result is Failure<E> {
  return !result.ok;
}

export function mapResult<T, U, E extends PlatformError>(
  result: Result<T, E>,
  mapper: (value: T) => U,
): Result<U, E> {
  if (result.ok) {
    return success(mapper(result.value));
  }

  return result;
}

export function flatMapResult<
  T,
  U,
  E extends PlatformError,
>(
  result: Result<T, E>,
  mapper: (value: T) => Result<U, E>,
): Result<U, E> {
  if (result.ok) {
    return mapper(result.value);
  }

  return result;
}

export function unwrapResult<T, E extends PlatformError>(
  result: Result<T, E>,
): T {
  if (result.ok) {
    return result.value;
  }

  throw result.error;
}
