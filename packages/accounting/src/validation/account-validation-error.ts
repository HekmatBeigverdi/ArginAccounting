export type AccountField =
  | "id"
  | "companyId"
  | "parentId"
  | "code"
  | "name"
  | "postingAllowed"
  | "revaluationEnabled"
  | "displayOrder"
  | "createdAt"
  | "updatedAt"
  | "version";

export interface AccountValidationIssue {
  readonly field: AccountField;
  readonly message: string;
}

export class AccountValidationError extends Error {
  readonly issues: readonly AccountValidationIssue[];

  constructor(issues: readonly AccountValidationIssue[]) {
    super("مشخصات حساب معتبر نیست.");
    this.name = "AccountValidationError";
    this.issues = Object.freeze([...issues]);
  }
}
