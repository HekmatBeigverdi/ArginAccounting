export interface ApprovalConcurrencyErrorOptions {
  approvalRequestId: string;
  expectedVersion: number;
}

export class ApprovalConcurrencyError
extends Error {
  readonly approvalRequestId: string;
  readonly expectedVersion: number;

  constructor(
    options: ApprovalConcurrencyErrorOptions
  ) {
    super(
      [
        `Approval request "${options.approvalRequestId}"`,
        "was modified by another operation.",
        `Expected version: ${options.expectedVersion}.`
      ].join(" ")
    );

    this.name =
      "ApprovalConcurrencyError";

    this.approvalRequestId =
      options.approvalRequestId;

    this.expectedVersion =
      options.expectedVersion;

    Object.setPrototypeOf(
      this,
      ApprovalConcurrencyError.prototype
    );
  }
}
