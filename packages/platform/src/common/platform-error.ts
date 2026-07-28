export type PlatformErrorCategory =
  | "validation"
  | "not-found"
  | "conflict"
  | "concurrency"
  | "unauthorized"
  | "forbidden"
  | "infrastructure"
  | "unexpected";

export interface PlatformErrorOptions {
  code: string;
  message: string;
  category: PlatformErrorCategory;
  details?: Readonly<Record<string, unknown>>;
  cause?: unknown;
}

export class PlatformError extends Error {
  readonly code: string;
  readonly category: PlatformErrorCategory;
  readonly details: Readonly<Record<string, unknown>>;
  readonly originalCause: unknown;

  constructor(options: PlatformErrorOptions) {
    super(options.message);

    this.name = "PlatformError";
    this.code = options.code;
    this.category = options.category;
    this.details = options.details ?? {};
    this.originalCause = options.cause;
  }

  static validation(
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): PlatformError {
    return new PlatformError({
      code,
      message,
      category: "validation",
      ...(details === undefined ? {} : { details }),
    });
  }

  static notFound(
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): PlatformError {
    return new PlatformError({
      code,
      message,
      category: "not-found",
      ...(details === undefined ? {} : { details }),
    });
  }

  static conflict(
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): PlatformError {
    return new PlatformError({
      code,
      message,
      category: "conflict",
      ...(details === undefined ? {} : { details }),
    });
  }

  static concurrency(
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): PlatformError {
    return new PlatformError({
      code,
      message,
      category: "concurrency",
      ...(details === undefined ? {} : { details }),
    });
  }

  static unauthorized(
    code: string,
    message: string,
  ): PlatformError {
    return new PlatformError({
      code,
      message,
      category: "unauthorized",
    });
  }

  static forbidden(
    code: string,
    message: string,
  ): PlatformError {
    return new PlatformError({
      code,
      message,
      category: "forbidden",
    });
  }

  static infrastructure(
    code: string,
    message: string,
    cause?: unknown,
  ): PlatformError {
    return new PlatformError({
      code,
      message,
      category: "infrastructure",
      cause,
    });
  }

  static unexpected(
    message = "An unexpected platform error occurred.",
    cause?: unknown,
  ): PlatformError {
    return new PlatformError({
      code: "platform.unexpected",
      message,
      category: "unexpected",
      cause,
    });
  }
}

export function toPlatformError(error: unknown): PlatformError {
  if (error instanceof PlatformError) {
    return error;
  }

  if (error instanceof Error) {
    return PlatformError.unexpected(error.message, error);
  }

  return PlatformError.unexpected(
    "An unknown platform error occurred.",
    error,
  );
}
