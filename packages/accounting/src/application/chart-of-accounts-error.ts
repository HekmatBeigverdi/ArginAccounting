export type ChartOfAccountsErrorCode =
  | "PERMISSION_DENIED"
  | "ACCOUNT_NOT_FOUND"
  | "CODING_SETTINGS_NOT_FOUND"
  | "DUPLICATE_ACCOUNT_CODE"
  | "ACCOUNT_TREE_CYCLE"
  | "VERSION_MISMATCH";

export class ChartOfAccountsError extends Error {
  constructor(
    readonly code: ChartOfAccountsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ChartOfAccountsError";
  }
}
