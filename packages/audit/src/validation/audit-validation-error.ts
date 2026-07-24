export interface AuditValidationIssue {
  field: string;
  message: string;
}

export class AuditValidationError extends Error {
  readonly issues: AuditValidationIssue[];

  constructor(
    issues: AuditValidationIssue[]
  ) {
    super(
      issues
        .map((issue) => issue.message)
        .join(" ")
    );

    this.name = "AuditValidationError";
    this.issues = issues;
  }
}
