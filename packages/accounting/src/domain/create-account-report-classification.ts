import type {
  AccountReportClassification,
  CreateAccountReportClassificationContext,
  CreateAccountReportClassificationInput,
} from "./account-report-classification.ts";
import {
  AccountReportClassificationValidationError,
} from "../validation/account-report-classification-validation-error.ts";
import {
  validateAccountReportClassification,
} from "../validation/validate-account-report-classification.ts";

export function createAccountReportClassification(
  input: CreateAccountReportClassificationInput = {},
  context: CreateAccountReportClassificationContext,
): AccountReportClassification {
  const managementTags = Object.freeze(
    (input.managementTags ?? []).map(
      normalizeManagementTag,
    ),
  );

  const classification: AccountReportClassification = {
    balanceSheetSection:
      input.balanceSheetSection ?? null,
    incomeStatementSection:
      input.incomeStatementSection ?? null,
    cashFlowCategory: input.cashFlowCategory ?? null,
    cashEquivalent: input.cashEquivalent ?? false,
    receivable: input.receivable ?? false,
    payable: input.payable ?? false,
    managementTags,
  };

  const issues = validateAccountReportClassification(
    classification,
    context.statementType,
  );

  if (issues.length > 0) {
    throw new AccountReportClassificationValidationError(
      issues,
    );
  }

  return Object.freeze(classification);
}

function normalizeManagementTag(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}
