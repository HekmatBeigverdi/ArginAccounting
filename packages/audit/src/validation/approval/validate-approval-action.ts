import type {
  ApprovalAction
} from "../../domain/approval/approval-action.ts";

import type {
  ApprovalActor
} from "../../domain/approval/approval-actor.ts";

import type {
  ApprovalStatus
} from "../../domain/approval/approval-status.ts";

import {
  canApplyApprovalAction
} from "../../domain/approval/approval-transition.ts";

import {
  ApprovalTransitionError
} from "./approval-transition-error.ts";

import {
  ApprovalValidationError,
  type ApprovalValidationIssue
} from "./approval-validation-error.ts";

export interface ValidateApprovalActionInput {
  currentStatus: ApprovalStatus;
  action: ApprovalAction;
  actor: ApprovalActor;
  comment?: string | null;
}

export function validateApprovalAction(
  input: ValidateApprovalActionInput
): void {
  const issues: ApprovalValidationIssue[] = [];

  if (
    input.actor.displayName
      .trim()
      .length === 0
  ) {
    issues.push({
      field: "actor.displayName",
      message:
        "نام عامل اقدام الزامی است."
    });
  }

  if (
    input.actor.type === "user" &&
    !input.actor.id
  ) {
    issues.push({
      field: "actor.id",
      message:
        "شناسه کاربر انجام‌دهنده اقدام الزامی است."
    });
  }

  if (
    input.comment !== undefined &&
    input.comment !== null &&
    input.comment.length > 2000
  ) {
    issues.push({
      field: "comment",
      message:
        "توضیحات اقدام نمی‌تواند بیشتر از ۲۰۰۰ نویسه باشد."
    });
  }

  if (
    (
      input.action === "reject" ||
      input.action === "return-to-draft"
    ) &&
    !input.comment?.trim()
  ) {
    issues.push({
      field: "comment",
      message:
        "برای رد یا بازگرداندن درخواست، ثبت توضیح الزامی است."
    });
  }

  if (issues.length > 0) {
    throw new ApprovalValidationError(
      issues
    );
  }

  if (
    !canApplyApprovalAction(
      input.currentStatus,
      input.action
    )
  ) {
    throw new ApprovalTransitionError(
      input.currentStatus,
      input.action
    );
  }
}
