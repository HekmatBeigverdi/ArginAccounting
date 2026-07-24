import type {
  ApprovalActor
} from "../../domain/approval/approval-actor";

import type {
  ApprovalRequest
} from "../../domain/approval/approval-request";

import type {
  ApprovalCommandContext
} from "./approval-command-context";

import {
  applyApprovalAction
} from "./apply-approval-action";

export interface ApprovalActionCommand {
  approvalRequestId: string;
  actor: ApprovalActor;
  comment?: string | null;
}

function runAction(
  context: ApprovalCommandContext,
  action:
    | "submit"
    | "approve"
    | "reject"
    | "return-to-draft"
    | "cancel"
    | "comment",
  command: ApprovalActionCommand
): Promise<ApprovalRequest> {
  return applyApprovalAction(context, {
    approvalRequestId: command.approvalRequestId,
    action,
    actor: command.actor,
    ...(command.comment !== undefined
      ? { comment: command.comment }
      : {})
  });
}

export function submitApprovalRequest(
  context: ApprovalCommandContext,
  command: ApprovalActionCommand
): Promise<ApprovalRequest> {
  return runAction(context, "submit", command);
}

export function approveApprovalRequest(
  context: ApprovalCommandContext,
  command: ApprovalActionCommand
): Promise<ApprovalRequest> {
  return runAction(context, "approve", command);
}

export function rejectApprovalRequest(
  context: ApprovalCommandContext,
  command: ApprovalActionCommand
): Promise<ApprovalRequest> {
  return runAction(context, "reject", command);
}

export function returnApprovalRequestToDraft(
  context: ApprovalCommandContext,
  command: ApprovalActionCommand
): Promise<ApprovalRequest> {
  return runAction(context, "return-to-draft", command);
}

export function cancelApprovalRequest(
  context: ApprovalCommandContext,
  command: ApprovalActionCommand
): Promise<ApprovalRequest> {
  return runAction(context, "cancel", command);
}

export function commentOnApprovalRequest(
  context: ApprovalCommandContext,
  command: ApprovalActionCommand
): Promise<ApprovalRequest> {
  return runAction(context, "comment", command);
}
