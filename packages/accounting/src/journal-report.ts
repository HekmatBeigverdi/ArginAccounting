import type { Account } from "./domain/account.ts";
import type { GeneralLedgerJournalLineFact } from "./general-ledger.ts";
import {
  accountingReportFactMatchesBaseScope,
  calculateAccountBalanceTurnover,
  safeAccountingReportAdd,
  validateAccountingReportFact,
} from "./reporting-balance.ts";
import type { NormalizedAccountingReportQuery } from "./reporting.ts";

export interface JournalReportJournalLineFact extends GeneralLedgerJournalLineFact {
  readonly voucherReference?: string | null;
}

export interface JournalReportDimensionAssignment {
  readonly dimensionTypeId: string;
  readonly memberId: string;
}

export interface JournalReportRow {
  readonly voucherId: string;
  readonly journalLineId: string;
  readonly voucherDate: string;
  readonly voucherNumber: string;
  readonly voucherReference: string | null;
  readonly lineOrder: number;
  readonly accountId: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly description: string | null;
  readonly dimensions: readonly JournalReportDimensionAssignment[];
  readonly debit: number;
  readonly credit: number;
}

export interface JournalReportTotals {
  readonly debit: number;
  readonly credit: number;
}

export interface JournalReportResult {
  readonly rows: readonly JournalReportRow[];
  readonly totals: JournalReportTotals;
  readonly isBalanced: boolean;
}

export type JournalReportErrorCode =
  | "report.journal.invalid-detail-fact"
  | "report.journal.account-not-found";

export class JournalReportError extends Error {
  readonly code: JournalReportErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: JournalReportErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "JournalReportError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export function createJournalReport(
  query: NormalizedAccountingReportQuery,
  accounts: readonly Account[],
  facts: readonly JournalReportJournalLineFact[],
): JournalReportResult {
  const companyAccounts = accounts.filter((account) => account.companyId === query.companyId);
  const accountById = new Map(companyAccounts.map((account) => [account.id, account] as const));
  const selectedPostingAccountIds = resolveSelectedPostingAccountIds(query, accounts, facts);

  const rows = facts
    .filter((fact) =>
      selectedPostingAccountIds.has(fact.accountId) &&
      accountingReportFactMatchesBaseScope(fact, query) &&
      fact.voucherDate >= query.period.fromDate &&
      (!query.period.fiscalPeriodId || fact.fiscalPeriodId === query.period.fiscalPeriodId))
    .map((fact) => {
      validateAccountingReportFact(fact);
      validateJournalReportFact(fact);
      return fact;
    })
    .sort(compareJournalReportFacts)
    .map((fact) => {
      const account = accountById.get(fact.accountId);
      if (!account) {
        throw new JournalReportError(
          "report.journal.account-not-found",
          "حساب ردیف دفتر روزنامه در محدوده شرکت پیدا نشد.",
          { accountId: fact.accountId, journalLineId: fact.journalLineId },
        );
      }
      return Object.freeze({
        voucherId: fact.voucherId,
        journalLineId: fact.journalLineId,
        voucherDate: fact.voucherDate,
        voucherNumber: fact.voucherNumber.trim(),
        voucherReference: normalizeText(fact.voucherReference),
        lineOrder: fact.lineOrder,
        accountId: account.id,
        accountCode: String(account.code),
        accountName: String(account.name),
        description: normalizeText(fact.lineDescription ?? fact.voucherDescription),
        dimensions: Object.freeze(
          [...(fact.dimensions ?? [])]
            .map((item) => Object.freeze({
              dimensionTypeId: item.dimensionTypeId,
              memberId: item.memberId,
            }))
            .sort(compareDimensions),
        ),
        debit: fact.debit,
        credit: fact.credit,
      });
    });

  let debit = 0;
  let credit = 0;
  for (const row of rows) {
    debit = safeAccountingReportAdd(debit, row.debit);
    credit = safeAccountingReportAdd(credit, row.credit);
  }

  return Object.freeze({
    rows: Object.freeze(rows),
    totals: Object.freeze({ debit, credit }),
    isBalanced: debit === credit,
  });
}

function resolveSelectedPostingAccountIds(
  query: NormalizedAccountingReportQuery,
  accounts: readonly Account[],
  facts: readonly JournalReportJournalLineFact[],
): ReadonlySet<string> {
  const balanceRows = calculateAccountBalanceTurnover(query, accounts, facts);
  const ids = new Set<string>();
  for (const row of balanceRows) {
    for (const accountId of row.postingAccountIds) ids.add(accountId);
  }
  return ids;
}

function validateJournalReportFact(fact: JournalReportJournalLineFact): void {
  if (!fact.voucherNumber.trim() || !Number.isSafeInteger(fact.lineOrder) || fact.lineOrder < 1) {
    throw new JournalReportError(
      "report.journal.invalid-detail-fact",
      "شماره سند یا ترتیب ردیف دفتر روزنامه معتبر نیست.",
      { voucherId: fact.voucherId, journalLineId: fact.journalLineId },
    );
  }
}

function compareJournalReportFacts(
  left: JournalReportJournalLineFact,
  right: JournalReportJournalLineFact,
): number {
  return compareText(left.voucherDate, right.voucherDate) ||
    compareVoucherNumber(left.voucherNumber, right.voucherNumber) ||
    left.lineOrder - right.lineOrder ||
    compareText(left.voucherId, right.voucherId) ||
    compareText(left.journalLineId, right.journalLineId);
}

function compareVoucherNumber(left: string, right: string): number {
  const l = left.trim();
  const r = right.trim();
  const ln = /^\d+$/.test(l) ? Number(l) : undefined;
  const rn = /^\d+$/.test(r) ? Number(r) : undefined;
  if ((ln === undefined) !== (rn === undefined)) return ln === undefined ? -1 : 1;
  if (ln !== undefined && rn !== undefined && Number.isSafeInteger(ln) && Number.isSafeInteger(rn) && ln !== rn) {
    return ln - rn;
  }
  return compareText(l, r);
}

function compareDimensions(left: JournalReportDimensionAssignment, right: JournalReportDimensionAssignment): number {
  return compareText(left.dimensionTypeId, right.dimensionTypeId) || compareText(left.memberId, right.memberId);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  return normalized || null;
}
