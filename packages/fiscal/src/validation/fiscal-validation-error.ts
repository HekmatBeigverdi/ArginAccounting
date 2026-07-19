export interface FiscalValidationIssue {
  field: string;
  message: string;
}

export class FiscalValidationError extends Error {
  readonly issues: FiscalValidationIssue[];

  constructor(issues: FiscalValidationIssue[]) {
    super("Fiscal information is invalid.");

    this.name = "FiscalValidationError";
    this.issues = issues;
  }
}
