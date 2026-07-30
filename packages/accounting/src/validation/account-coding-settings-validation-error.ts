export type AccountCodingSettingsField =
  | "companyId"
  | "groupCodeLength"
  | "generalCodeLength"
  | "subsidiaryCodeLength"
  | "version";

export interface AccountCodingSettingsValidationIssue {
  readonly field: AccountCodingSettingsField;
  readonly message: string;
}

export class AccountCodingSettingsValidationError
  extends Error {
  readonly issues:
    readonly AccountCodingSettingsValidationIssue[];

  constructor(
    issues:
      readonly AccountCodingSettingsValidationIssue[],
  ) {
    super("Account coding settings are invalid.");

    this.name =
      "AccountCodingSettingsValidationError";
    this.issues = Object.freeze([...issues]);
  }
}
