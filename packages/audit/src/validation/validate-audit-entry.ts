import type {
  CreateAuditEntryInput
} from "../domain/audit-entry";

import {
  AuditValidationError,
  type AuditValidationIssue
} from "./audit-validation-error";

export function validateAuditEntryInput(
  input: CreateAuditEntryInput
): void {
  const issues: AuditValidationIssue[] = [];

  if (
    input.actor.displayName.trim().length === 0
  ) {
    issues.push({
      field: "actor.displayName",
      message:
        "نام نمایشی عامل رویداد الزامی است."
    });
  }

  if (
    input.actor.type === "user" &&
    !input.actor.id
  ) {
    issues.push({
      field: "actor.id",
      message:
        "شناسه کاربر برای رویداد کاربری الزامی است."
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
    input.message !== undefined &&
    input.message !== null &&
    input.message.length > 1000
  ) {
    issues.push({
      field: "message",
      message:
        "شرح رویداد نمی‌تواند بیشتر از ۱۰۰۰ نویسه باشد."
    });
  }

  if (
    input.reason !== undefined &&
    input.reason !== null &&
    input.reason.length > 1000
  ) {
    issues.push({
      field: "reason",
      message:
        "دلیل رویداد نمی‌تواند بیشتر از ۱۰۰۰ نویسه باشد."
    });
  }

  if (
    input.outcome === "failure" &&
    !input.reason?.trim()
  ) {
    issues.push({
      field: "reason",
      message:
        "برای رویداد ناموفق، ثبت دلیل الزامی است."
    });
  }

  if (
    input.outcome === "denied" &&
    !input.reason?.trim()
  ) {
    issues.push({
      field: "reason",
      message:
        "برای عملیات ردشده، ثبت دلیل الزامی است."
    });
  }

  if (issues.length > 0) {
    throw new AuditValidationError(issues);
  }
}
