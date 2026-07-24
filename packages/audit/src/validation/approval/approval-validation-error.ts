export interface ApprovalValidationIssue {
  field: string;
  message: string;
}

export class ApprovalValidationError
  extends Error {
  readonly issues: ApprovalValidationIssue[];

  constructor(
    issues: ApprovalValidationIssue[]
  ) {
    super(
      issues
        .map((issue) => issue.message)
        .join(" ")
    );

    this.name = "ApprovalValidationError";
    this.issues = issues;
  }
}
