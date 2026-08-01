export type AccountDimensionPolicyField =
  | "id"
  | "companyId"
  | "accountId"
  | "dimensionTypeId"
  | "requirement"
  | "createdAt"
  | "updatedAt"
  | "version";

export interface AccountDimensionPolicyValidationIssue {
  readonly field: AccountDimensionPolicyField;
  readonly message: string;
}

export class AccountDimensionPolicyValidationError
  extends Error {
  readonly issues:
    readonly AccountDimensionPolicyValidationIssue[];

  constructor(
    issues:
      readonly AccountDimensionPolicyValidationIssue[],
  ) {
    super("سیاست ارتباط حساب و بُعد حسابداری معتبر نیست.");
    this.name = "AccountDimensionPolicyValidationError";
    this.issues = Object.freeze([...issues]);
  }
}
