import type {
  ApprovalAction
} from "./approval-action.ts";

import type {
  ApprovalStatus
} from "./approval-status.ts";

export interface ApprovalTransition {
  from: ApprovalStatus;
  action: ApprovalAction;
  to: ApprovalStatus;
}

export const approvalTransitions:
  readonly ApprovalTransition[] = [
    {
      from: "draft",
      action: "submit",
      to: "pending"
    },
    {
      from: "pending",
      action: "approve",
      to: "approved"
    },
    {
      from: "pending",
      action: "reject",
      to: "rejected"
    },
    {
      from: "pending",
      action: "return-to-draft",
      to: "draft"
    },
    {
      from: "draft",
      action: "cancel",
      to: "cancelled"
    },
    {
      from: "pending",
      action: "cancel",
      to: "cancelled"
    }
  ];

export function resolveApprovalTransition(
  currentStatus: ApprovalStatus,
  action: ApprovalAction
): ApprovalStatus | null {
  const transition =
    approvalTransitions.find(
      (item) =>
        item.from === currentStatus &&
        item.action === action
    );

  return transition?.to ?? null;
}

export function canApplyApprovalAction(
  currentStatus: ApprovalStatus,
  action: ApprovalAction
): boolean {
  if (action === "comment") {
    return true;
  }

  return (
    resolveApprovalTransition(
      currentStatus,
      action
    ) !== null
  );
}
