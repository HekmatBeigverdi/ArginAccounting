export interface CompanyValidationIssue {
  field: string;
  message: string;
}

export class CompanyValidationError extends Error {
  readonly issues: CompanyValidationIssue[];

  constructor(issues: CompanyValidationIssue[]) {
    super("Company information is invalid.");

    this.name = "CompanyValidationError";
    this.issues = issues;
  }
}
