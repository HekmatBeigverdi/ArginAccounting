export type AccountingDimensionTypeField =
  | "id"
  | "companyId"
  | "code"
  | "name"
  | "englishName"
  | "displayOrder"
  | "sourceReferenceId"
  | "createdAt"
  | "updatedAt"
  | "version";

export interface AccountingDimensionTypeValidationIssue {
  readonly field: AccountingDimensionTypeField;
  readonly message: string;
}

export class AccountingDimensionTypeValidationError
  extends Error {
  readonly issues:
    readonly AccountingDimensionTypeValidationIssue[];

  constructor(
    issues:
      readonly AccountingDimensionTypeValidationIssue[],
  ) {
    super("مشخصات نوع بُعد حسابداری معتبر نیست.");
    this.name =
      "AccountingDimensionTypeValidationError";
    this.issues = Object.freeze([...issues]);
  }
}
