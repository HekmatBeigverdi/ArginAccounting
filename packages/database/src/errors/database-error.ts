export type DatabaseErrorCode =
  | "CONNECTION_FAILED"
  | "QUERY_FAILED"
  | "MIGRATION_FAILED"
  | "DATABASE_NOT_AVAILABLE"
  | "UNKNOWN_DATABASE_ERROR";

export class DatabaseError extends Error {
  readonly code: DatabaseErrorCode;
  readonly cause?: unknown;

  constructor(
    code: DatabaseErrorCode,
    message: string,
    cause?: unknown
  ) {
    super(message);

    this.name = "DatabaseError";
    this.code = code;
    this.cause = cause;
  }
}
