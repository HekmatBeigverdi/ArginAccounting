import type {
  CreateApprovalRequestInput
} from "../../domain/approval/approval-request";

import {
  ApprovalValidationError,
  type ApprovalValidationIssue
} from "./approval-validation-error";

export function validateApprovalRequestInput(
  input: CreateApprovalRequestInput
): void {
  const issues: ApprovalValidationIssue[] = [];

  if (
    input.requestType.trim().length === 0
  ) {
    issues.push({
      field: "requestType",
      message:
        "نوع درخواست تأیید الزامی است."
    });
  }

  if (
    input.requestType.length > 100
  ) {
    issues.push({
      field: "requestType",
      message:
        "نوع درخواست تأیید نمی‌تواند بیشتر از ۱۰۰ نویسه باشد."
    });
  }

  if (input.title.trim().length === 0) {
    issues.push({
      field: "title",
      message:
        "عنوان درخواست تأیید الزامی است."
    });
  }

  if (input.title.length > 250) {
    issues.push({
      field: "title",
      message:
        "عنوان درخواست تأیید نمی‌تواند بیشتر از ۲۵۰ نویسه باشد."
    });
  }

  if (
    input.description !== undefined &&
    input.description !== null &&
    input.description.length > 2000
  ) {
    issues.push({
      field: "description",
      message:
        "توضیحات درخواست نمی‌تواند بیشتر از ۲۰۰۰ نویسه باشد."
    });
  }

  if (
    input.target.entityType.trim().length === 0
  ) {
    issues.push({
      field: "target.entityType",
      message:
        "نوع موجودیت هدف الزامی است."
    });
  }

  if (
    input.target.entityId.trim().length === 0
  ) {
    issues.push({
      field: "target.entityId",
      message:
        "شناسه موجودیت هدف الزامی است."
    });
  }

  if (
    input.createdBy.displayName
      .trim()
      .length === 0
  ) {
    issues.push({
      field: "createdBy.displayName",
      message:
        "نام ایجادکننده درخواست الزامی است."
    });
  }

  if (
    input.createdBy.type === "user" &&
    !input.createdBy.id
  ) {
    issues.push({
      field: "createdBy.id",
      message:
        "شناسه کاربر ایجادکننده الزامی است."
    });
  }

  if (issues.length > 0) {
    throw new ApprovalValidationError(
      issues
    );
  }
}
