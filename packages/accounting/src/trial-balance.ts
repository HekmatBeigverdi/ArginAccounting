import type { Account, AccountLevel } from "./domain/account.ts";
import {
  calculateAccountBalanceTurnover,
  type AccountingReportAccountBalanceRow,
  type AccountingReportJournalLineFact,
} from "./reporting-balance.ts";
import type { NormalizedAccountingReportQuery } from "./reporting.ts";

export type TrialBalanceColumnMode = 2 | 4 | 6 | 8;

export interface TrialBalanceRow {
  readonly accountId: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly level: AccountLevel;
  readonly openingDebit: number;
  readonly openingCredit: number;
  readonly periodDebit: number;
  readonly periodCredit: number;
  readonly endingDebit: number;
  readonly endingCredit: number;
}

export interface TrialBalanceTotals {
  readonly openingDebit: number;
  readonly openingCredit: number;
  readonly periodDebit: number;
  readonly periodCredit: number;
  readonly endingDebit: number;
  readonly endingCredit: number;
}

export interface TrialBalanceResult {
  readonly mode: TrialBalanceColumnMode;
  readonly rows: readonly TrialBalanceRow[];
  readonly totals: TrialBalanceTotals;
  readonly isBalanced: boolean;
}

export function createTrialBalance(
  query: NormalizedAccountingReportQuery,
  accounts: readonly Account[],
  facts: readonly AccountingReportJournalLineFact[],
  mode: TrialBalanceColumnMode = 6,
): TrialBalanceResult {
  const balanceRows = calculateAccountBalanceTurnover(query, accounts, facts);
  const accountById = new Map(accounts.map((account) => [account.id, account] as const));

  const rows = balanceRows
    .filter((row) => shouldIncludeRow(row, query.includeZeroBalances))
    .map((row) => projectRow(row, accountById));

  const totals = rows.reduce<TrialBalanceTotals>((sum, row) => ({
    openingDebit: safeAdd(sum.openingDebit, row.openingDebit),
    openingCredit: safeAdd(sum.openingCredit, row.openingCredit),
    periodDebit: safeAdd(sum.periodDebit, row.periodDebit),
    periodCredit: safeAdd(sum.periodCredit, row.periodCredit),
    endingDebit: safeAdd(sum.endingDebit, row.endingDebit),
    endingCredit: safeAdd(sum.endingCredit, row.endingCredit),
  }), {
    openingDebit: 0,
    openingCredit: 0,
    periodDebit: 0,
    periodCredit: 0,
    endingDebit: 0,
    endingCredit: 0,
  });

  return Object.freeze({
    mode,
    rows: Object.freeze(rows),
    totals: Object.freeze(totals),
    isBalanced:
      totals.openingDebit === totals.openingCredit &&
      totals.periodDebit === totals.periodCredit &&
      totals.endingDebit === totals.endingCredit,
  });
}

function shouldIncludeRow(row: AccountingReportAccountBalanceRow, includeZeroBalances: boolean): boolean {
  if (includeZeroBalances) return true;
  return row.hasOpeningBalance || row.hasPeriodMovement || row.hasEndingBalance;
}

function projectRow(
  row: AccountingReportAccountBalanceRow,
  accountById: ReadonlyMap<string, Account>,
): TrialBalanceRow {
  const account = accountById.get(row.accountId);
  if (!account) throw new Error(`Trial balance account not found: ${row.accountId}`);
  return Object.freeze({
    accountId: row.accountId,
    accountCode: String(account.code),
    accountName: String(account.name),
    level: account.level,
    openingDebit: row.opening.debit,
    openingCredit: row.opening.credit,
    periodDebit: row.period.debit,
    periodCredit: row.period.credit,
    endingDebit: row.ending.debit,
    endingCredit: row.ending.credit,
  });
}

function safeAdd(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error("Trial balance total overflow");
  return result;
}
