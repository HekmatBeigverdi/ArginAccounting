export type ChartOfAccountsErrorCode =
  | "PERMISSION_DENIED"
  | "ACCOUNT_NOT_FOUND"
  | "CODING_SETTINGS_NOT_FOUND"
  | "DUPLICATE_ACCOUNT_CODE"
  | "ACCOUNT_TREE_CYCLE"
  | "ACCOUNT_HAS_CHILDREN"
  | "ACCOUNT_HAS_FINANCIAL_ACTIVITY"
  | "ACCOUNT_CODE_CHANGE_AFTER_USE_NOT_ALLOWED"
  | "ACCOUNT_HAS_ACTIVE_CHILDREN"
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
