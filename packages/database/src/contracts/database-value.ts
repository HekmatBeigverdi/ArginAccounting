/**
 * Values that may be passed safely to database query parameters.
 *
 * Monetary values must be converted to integer Rial values before
 * crossing the database boundary.
 */
export type DatabaseValue =
  | string
  | number
  | boolean
  | null
  | Uint8Array;
