import type {
  AccountReportClassification,
} from "../domain/account-report-classification.ts";
import type {
  AccountStatementType,
} from "../domain/account.ts";
import type {
  AccountReportClassificationValidationIssue,
} from "./account-report-classification-validation-error.ts";

export function validateAccountReportClassification(
  classification: AccountReportClassification,
  statementType: AccountStatementType,
): readonly AccountReportClassificationValidationIssue[] {
  const issues:
    AccountReportClassificationValidationIssue[] = [];

  if (
    classification.balanceSheetSection !== null &&
    statementType !== "balance_sheet"
  ) {
    issues.push({
      field: "balanceSheetSection",
      message:
        "بخش ترازنامه فقط برای حساب‌های ترازنامه‌ای مجاز است.",
    });
  }

  if (
    classification.incomeStatementSection !== null &&
    statementType !== "income_statement"
  ) {
    issues.push({
      field: "incomeStatementSection",
      message:
        "بخش سود و زیان فقط برای حساب‌های سود و زیانی مجاز است.",
    });
  }

  if (
    statementType === "memorandum" &&
    (
      classification.cashEquivalent ||
      classification.receivable ||
      classification.payable
    )
  ) {
    for (const field of [
      "cashEquivalent",
      "receivable",
      "payable",
    ] as const) {
      if (classification[field]) {
        issues.push({
          field,
          message:
            "پرچم‌های مالی برای حساب انتظامی مجاز نیستند.",
        });
      }
    }
  }

  if (
    classification.receivable &&
    classification.payable
  ) {
    issues.push({
      field: "payable",
      message:
        "یک حساب نمی‌تواند هم‌زمان دریافتنی و پرداختنی باشد.",
    });
  }

  const seenTags = new Set<string>();

  classification.managementTags.forEach((tag) => {
    if (tag.length === 0 || tag.length > 100) {
      issues.push({
        field: "managementTags",
        message:
          "هر برچسب مدیریتی باید بین ۱ تا ۱۰۰ نویسه باشد.",
      });
    }

    const key = tag.toLocaleLowerCase("fa-IR");
    if (seenTags.has(key)) {
      issues.push({
        field: "managementTags",
        message:
          "برچسب‌های مدیریتی تکراری مجاز نیستند.",
      });
    }
    seenTags.add(key);
  });

  return Object.freeze(issues);
}
