import type { Account, AccountLevel } from "./domain/account.ts";
import {
  accountingReportFactMatchesBaseScope,
  calculateAccountBalanceTurnover,
  safeAccountingReportAdd,
  splitAccountingReportNet,
  validateAccountingReportFact,
  type AccountingReportBalanceSide,
  type AccountingReportJournalLineFact,
} from "./reporting-balance.ts";
import type { NormalizedAccountingReportQuery } from "./reporting.ts";

export interface GeneralLedgerJournalLineFact extends AccountingReportJournalLineFact {
  readonly voucherNumber: string;
  readonly lineOrder: number;
  readonly voucherDescription?: string | null;
  readonly lineDescription?: string | null;
}

export interface GeneralLedgerMovementRow {
  readonly voucherId: string;
  readonly journalLineId: string;
  readonly voucherDate: string;
  readonly voucherNumber: string;
  readonly lineOrder: number;
  readonly postingAccountId: string;
  readonly postingAccountCode: string;
  readonly postingAccountName: string;
  readonly description: string | null;
  readonly debit: number;
  readonly credit: number;
  readonly runningNet: number;
  readonly runningBalance: AccountingReportBalanceSide;
}

export interface GeneralLedgerAccountSection {
  readonly accountId: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly level: AccountLevel;
  readonly postingAccountIds: readonly string[];
  readonly openingNet: number;
  readonly openingBalance: AccountingReportBalanceSide;
  readonly periodDebit: number;
  readonly periodCredit: number;
  readonly endingNet: number;
  readonly endingBalance: AccountingReportBalanceSide;
  readonly movements: readonly GeneralLedgerMovementRow[];
}

export interface GeneralLedgerResult {
  readonly sections: readonly GeneralLedgerAccountSection[];
}

export type GeneralLedgerErrorCode =
  | "report.general-ledger.invalid-detail-fact"
  | "report.general-ledger.account-not-found";

export class GeneralLedgerError extends Error {
  readonly code: GeneralLedgerErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: GeneralLedgerErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "GeneralLedgerError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export function createGeneralLedger(
  query: NormalizedAccountingReportQuery,
  accounts: readonly Account[],
  facts: readonly GeneralLedgerJournalLineFact[],
): GeneralLedgerResult {
  const balanceRows = calculateAccountBalanceTurnover(query, accounts, facts);
  const accountById = new Map(
    accounts
      .filter((account) => account.companyId === query.companyId)
      .map((account) => [account.id, account] as const),
  );

  const sections = balanceRows
    .filter((balance) =>
      query.includeZeroBalances ||
      balance.hasOpeningBalance ||
      balance.hasPeriodMovement ||
      balance.hasEndingBalance)
    .map((balance) => {
      const account = accountById.get(balance.accountId);
      if (!account) {
        throw new GeneralLedgerError(
          "report.general-ledger.account-not-found",
          "حساب دفتر کل در محدوده شرکت پیدا نشد.",
          { accountId: balance.accountId },
        );
      }

      const postingSet = new Set(balance.postingAccountIds);
      const contributingPostingAccountIds = query.includeZeroBalances
        ? balance.postingAccountIds
        : balance.postingAccountIds.filter((accountId) =>
          facts.some((fact) =>
            fact.accountId === accountId && accountingReportFactMatchesBaseScope(fact, query)));
      const periodFacts = facts
        .filter((fact) =>
          postingSet.has(fact.accountId) &&
          accountingReportFactMatchesBaseScope(fact, query) &&
          fact.voucherDate >= query.period.fromDate &&
          (!query.period.fiscalPeriodId || fact.fiscalPeriodId === query.period.fiscalPeriodId))
        .map((fact) => {
          validateAccountingReportFact(fact);
          validateGeneralLedgerFact(fact);
          return fact;
        })
        .sort(compareGeneralLedgerFacts);

      let runningNet = balance.openingNet;
      let periodDebit = 0;
      let periodCredit = 0;

      const movements = periodFacts.map((fact) => {
        runningNet = safeAccountingReportAdd(runningNet, fact.debit);
        runningNet = safeAccountingReportAdd(runningNet, -fact.credit);
        periodDebit = safeAccountingReportAdd(periodDebit, fact.debit);
        periodCredit = safeAccountingReportAdd(periodCredit, fact.credit);

        const postingAccount = accountById.get(fact.accountId);
        if (!postingAccount) {
          throw new GeneralLedgerError(
            "report.general-ledger.account-not-found",
            "حساب ردیف دفتر کل در محدوده شرکت پیدا نشد.",
            { accountId: fact.accountId, journalLineId: fact.journalLineId },
          );
        }

        return Object.freeze({
          voucherId: fact.voucherId,
          journalLineId: fact.journalLineId,
          voucherDate: fact.voucherDate,
          voucherNumber: fact.voucherNumber,
          lineOrder: fact.lineOrder,
          postingAccountId: postingAccount.id,
          postingAccountCode: String(postingAccount.code),
          postingAccountName: String(postingAccount.name),
          description: normalizeDescription(fact.lineDescription ?? fact.voucherDescription),
          debit: fact.debit,
          credit: fact.credit,
          runningNet,
          runningBalance: splitAccountingReportNet(runningNet),
        });
      });

      if (periodDebit !== balance.period.debit || periodCredit !== balance.period.credit || runningNet !== balance.endingNet) {
        throw new GeneralLedgerError(
          "report.general-ledger.invalid-detail-fact",
          "گردش جزئی دفتر کل با موتور مانده حساب تطبیق ندارد.",
          { accountId: balance.accountId },
        );
      }

      return Object.freeze({
        accountId: account.id,
        accountCode: String(account.code),
        accountName: String(account.name),
        level: account.level,
        postingAccountIds: Object.freeze(contributingPostingAccountIds),
        openingNet: balance.openingNet,
        openingBalance: balance.opening,
        periodDebit,
        periodCredit,
        endingNet: runningNet,
        endingBalance: splitAccountingReportNet(runningNet),
        movements: Object.freeze(movements),
      });
    });

  return Object.freeze({ sections: Object.freeze(sections) });
}

function validateGeneralLedgerFact(fact: GeneralLedgerJournalLineFact): void {
  if (!fact.voucherNumber.trim() || !Number.isSafeInteger(fact.lineOrder) || fact.lineOrder < 1) {
    throw new GeneralLedgerError(
      "report.general-ledger.invalid-detail-fact",
      "اطلاعات ترتیب یا شماره سند برای دفتر کل معتبر نیست.",
      { voucherId: fact.voucherId, journalLineId: fact.journalLineId },
    );
  }
}

function compareGeneralLedgerFacts(
  left: GeneralLedgerJournalLineFact,
  right: GeneralLedgerJournalLineFact,
): number {
  return compareText(left.voucherDate, right.voucherDate) ||
    compareVoucherNumber(left.voucherNumber, right.voucherNumber) ||
    left.lineOrder - right.lineOrder ||
    compareText(left.voucherId, right.voucherId) ||
    compareText(left.journalLineId, right.journalLineId);
}

function compareVoucherNumber(left: string, right: string): number {
  const leftTrimmed = left.trim();
  const rightTrimmed = right.trim();
  const leftNumber = /^\d+$/.test(leftTrimmed) ? Number(leftTrimmed) : undefined;
  const rightNumber = /^\d+$/.test(rightTrimmed) ? Number(rightTrimmed) : undefined;

  if ((leftNumber === undefined) !== (rightNumber === undefined)) {
    return leftNumber === undefined ? -1 : 1;
  }

  if (
    leftNumber !== undefined &&
    rightNumber !== undefined &&
    Number.isSafeInteger(leftNumber) &&
    Number.isSafeInteger(rightNumber) &&
    leftNumber !== rightNumber
  ) {
    return leftNumber - rightNumber;
  }
  return compareText(leftTrimmed, rightTrimmed);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeDescription(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  return normalized || null;
}
