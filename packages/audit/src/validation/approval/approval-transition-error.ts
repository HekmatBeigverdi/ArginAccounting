import type {
  ApprovalAction
} from "../../domain/approval/approval-action";

import type {
  ApprovalStatus
} from "../../domain/approval/approval-status";

export class ApprovalTransitionError
  extends Error {
  readonly currentStatus: ApprovalStatus;
  readonly action: ApprovalAction;

  constructor(
    currentStatus: ApprovalStatus,
    action: ApprovalAction
  ) {
    super(
      `Action "${action}" is not allowed from status "${currentStatus}".`
    );

    this.name = "ApprovalTransitionError";
    this.currentStatus = currentStatus;
    this.action = action;
  }
}
