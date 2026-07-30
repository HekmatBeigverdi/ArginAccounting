export type AccountReportClassificationField =
  | "balanceSheetSection"
  | "incomeStatementSection"
  | "cashEquivalent"
  | "receivable"
  | "payable"
  | "managementTags";

export interface AccountReportClassificationValidationIssue {
  readonly field: AccountReportClassificationField;
  readonly message: string;
}

export class AccountReportClassificationValidationError
  extends Error {
  readonly issues:
    readonly AccountReportClassificationValidationIssue[];

  constructor(
    issues:
      readonly AccountReportClassificationValidationIssue[],
  ) {
    super(
      issues.map((issue) => issue.message).join(" "),
    );
    this.name =
      "AccountReportClassificationValidationError";
    this.issues = Object.freeze([...issues]);
  }
}
