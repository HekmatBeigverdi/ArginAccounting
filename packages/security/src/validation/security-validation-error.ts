export interface SecurityValidationIssue {
  field: string;
  message: string;
}

export class SecurityValidationError extends Error {
  readonly issues: SecurityValidationIssue[];

  constructor(issues: SecurityValidationIssue[]) {
    super("Security information is invalid.");

    this.name = "SecurityValidationError";
    this.issues = issues;
  }
}
