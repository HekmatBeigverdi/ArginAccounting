export type AccountingDimensionMemberField =
  | "id"
  | "companyId"
  | "dimensionTypeId"
  | "code"
  | "name"
  | "englishName"
  | "parentId"
  | "validFrom"
  | "validTo"
  | "displayOrder"
  | "sourceReferenceId"
  | "createdAt"
  | "updatedAt"
  | "version";

export interface AccountingDimensionMemberValidationIssue {
  readonly field: AccountingDimensionMemberField;
  readonly message: string;
}

export class AccountingDimensionMemberValidationError
  extends Error {
  readonly issues:
    readonly AccountingDimensionMemberValidationIssue[];

  constructor(
    issues:
      readonly AccountingDimensionMemberValidationIssue[],
  ) {
    super("مشخصات عضو بُعد حسابداری معتبر نیست.");
    this.name =
      "AccountingDimensionMemberValidationError";
    this.issues = Object.freeze([...issues]);
  }
}
