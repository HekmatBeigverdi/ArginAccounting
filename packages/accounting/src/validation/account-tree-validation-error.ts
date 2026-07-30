export type AccountTreeField =
  | "parentId"
  | "companyId"
  | "level"
  | "code";

export interface AccountTreeValidationIssue {
  readonly field: AccountTreeField;
  readonly message: string;
}

export class AccountTreeValidationError extends Error {
  readonly issues: readonly AccountTreeValidationIssue[];

  constructor(
    issues: readonly AccountTreeValidationIssue[],
  ) {
    super("ساختار درخت حساب معتبر نیست.");
    this.name = "AccountTreeValidationError";
    this.issues = Object.freeze([...issues]);
  }
}
