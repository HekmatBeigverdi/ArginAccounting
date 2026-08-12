import type {
  AccountDimensionPolicy,
} from "../domain/account-dimension-policy.ts";
import type {
  AccountingDimensionMember,
} from "../domain/accounting-dimension-member.ts";
import type {
  AccountingDimensionType,
} from "../domain/accounting-dimension-type.ts";
import type {
  JournalVoucher,
} from "../domain/journal-voucher.ts";
import type {
  AccountingDimensionAssignmentValidationIssue,
} from "./accounting-dimension-assignment-validation-error.ts";
import {
  validateAccountingDimensionAssignments,
} from "./validate-accounting-dimension-assignments.ts";

export interface JournalVoucherDimensionValidationIssue {
  readonly lineId: string;
  readonly lineOrder: number;
  readonly accountId: string;
  readonly issue: AccountingDimensionAssignmentValidationIssue;
}

export interface ValidateJournalVoucherDimensionsInput {
  readonly voucher: JournalVoucher;
  readonly policies: readonly AccountDimensionPolicy[];
  readonly dimensionTypes: readonly AccountingDimensionType[];
  readonly members: readonly AccountingDimensionMember[];
}

export function validateJournalVoucherDimensions(
  input: ValidateJournalVoucherDimensionsInput,
): readonly JournalVoucherDimensionValidationIssue[] {
  const issues: JournalVoucherDimensionValidationIssue[] = [];

  for (const line of input.voucher.lines) {
    const lineIssues = validateAccountingDimensionAssignments({
      companyId: input.voucher.companyId,
      accountId: line.accountId,
      documentDate: input.voucher.voucherDate,
      policies: input.policies,
      dimensionTypes: input.dimensionTypes,
      members: input.members,
      assignments: line.dimensionAssignments,
    });

    for (const issue of lineIssues) {
      issues.push({
        lineId: line.id,
        lineOrder: line.order,
        accountId: line.accountId,
        issue,
      });
    }
  }

  return Object.freeze(issues);
}
