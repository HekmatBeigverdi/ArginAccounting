export class ApprovalNotFoundError extends Error {
  constructor(readonly approvalRequestId: string) {
    super(`Approval request "${approvalRequestId}" was not found.`);
    this.name = "ApprovalNotFoundError";
    Object.setPrototypeOf(this, ApprovalNotFoundError.prototype);
  }
}

export class ApprovalAlreadySubmittedError extends Error {
  constructor(readonly approvalRequestId: string) {
    super(`Approval request "${approvalRequestId}" has already been submitted.`);
    this.name = "ApprovalAlreadySubmittedError";
    Object.setPrototypeOf(this, ApprovalAlreadySubmittedError.prototype);
  }
}

export class ApprovalAlreadyCompletedError extends Error {
  constructor(readonly approvalRequestId: string) {
    super(`Approval request "${approvalRequestId}" has already been completed.`);
    this.name = "ApprovalAlreadyCompletedError";
    Object.setPrototypeOf(this, ApprovalAlreadyCompletedError.prototype);
  }
}

export class ApprovalInvalidTransitionError extends Error {
  constructor(
    readonly approvalRequestId: string,
    readonly fromStatus: string,
    readonly requestedAction: string
  ) {
    super(
      `Approval request "${approvalRequestId}" cannot perform ` +
      `"${requestedAction}" from status "${fromStatus}".`
    );
    this.name = "ApprovalInvalidTransitionError";
    Object.setPrototypeOf(this, ApprovalInvalidTransitionError.prototype);
  }
}

export class ApprovalPermissionDeniedError extends Error {
  constructor(
    readonly approvalRequestId: string,
    readonly permission: string
  ) {
    super(
      `Permission "${permission}" is required for approval request ` +
      `"${approvalRequestId}".`
    );
    this.name = "ApprovalPermissionDeniedError";
    Object.setPrototypeOf(this, ApprovalPermissionDeniedError.prototype);
  }
}
