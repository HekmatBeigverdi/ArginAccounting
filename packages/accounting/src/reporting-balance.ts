import type { Account } from "./domain/account.ts";
import type {
  AccountingReportDimensionFilter,
  NormalizedAccountingReportQuery,
} from "./reporting.ts";

export interface AccountingReportJournalLineFact {
  readonly companyId: string;
  readonly branchId: string | null;
  readonly fiscalYearId: string;
  readonly fiscalPeriodId: string;
  readonly voucherId: string;
  readonly journalLineId: string;
  readonly voucherDate: string;
  readonly accountId: string;
  readonly debit: number;
  readonly credit: number;
  readonly isPostedFact: boolean;
  readonly dimensions?: readonly Readonly<{
    dimensionTypeId: string;
    memberId: string;
  }>[];
}

export interface AccountingReportBalanceSide {
  readonly debit: number;
  readonly credit: number;
}

export interface AccountingReportAccountBalanceRow {
  readonly accountId: string;
  readonly directPostingAccountIds: readonly string[];
  readonly postingAccountIds: readonly string[];
  readonly opening: AccountingReportBalanceSide;
  readonly period: Readonly<{
    debit: number;
    credit: number;
  }>;
  readonly ending: AccountingReportBalanceSide;
  readonly openingNet: number;
  readonly endingNet: number;
  readonly hasOpeningBalance: boolean;
  readonly hasPeriodMovement: boolean;
  readonly hasEndingBalance: boolean;
}

export type AccountingReportBalanceErrorCode =
  | "report.balance.invalid-account-tree"
  | "report.balance.invalid-fact"
  | "report.balance.overflow";

export class AccountingReportBalanceError extends Error {
  readonly code: AccountingReportBalanceErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: AccountingReportBalanceErrorCode,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "AccountingReportBalanceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export function calculateAccountBalanceTurnover(
  query: NormalizedAccountingReportQuery,
  accounts: readonly Account[],
  facts: readonly AccountingReportJournalLineFact[],
): readonly AccountingReportAccountBalanceRow[] {
  const companyAccounts = accounts.filter((account) => account.companyId === query.companyId);
  const accountById = new Map(companyAccounts.map((account) => [account.id, account] as const));
  validateAccountTree(companyAccounts, accountById);

  const selectedAccounts = selectAccounts(query, companyAccounts, accountById);
  const relevantFacts = facts.filter((fact) => factMatchesCommonQuery(fact, query));

  return Object.freeze(selectedAccounts.map((account) => {
    const postingAccountIds = collectPostingAccountIds(account.id, companyAccounts, accountById);
    const postingSet = new Set(postingAccountIds);
    let openingNet = 0;
    let periodDebit = 0;
    let periodCredit = 0;

    for (const fact of relevantFacts) {
      if (!postingSet.has(fact.accountId)) continue;
      validateFact(fact);

      if (fact.voucherDate < query.period.fromDate) {
        openingNet = safeAdd(openingNet, safeSubtract(fact.debit, fact.credit));
        continue;
      }
      if (fact.voucherDate <= query.period.toDate) {
        periodDebit = safeAdd(periodDebit, fact.debit);
        periodCredit = safeAdd(periodCredit, fact.credit);
      }
    }

    const endingNet = safeAdd(openingNet, safeSubtract(periodDebit, periodCredit));
    const opening = splitNet(openingNet);
    const ending = splitNet(endingNet);

    return Object.freeze({
      accountId: account.id,
      directPostingAccountIds: Object.freeze(account.postingAllowed ? [account.id] : []),
      postingAccountIds: Object.freeze(postingAccountIds),
      opening,
      period: Object.freeze({ debit: periodDebit, credit: periodCredit }),
      ending,
      openingNet,
      endingNet,
      hasOpeningBalance: openingNet !== 0,
      hasPeriodMovement: periodDebit !== 0 || periodCredit !== 0,
      hasEndingBalance: endingNet !== 0,
    });
  }));
}

function selectAccounts(
  query: NormalizedAccountingReportQuery,
  accounts: readonly Account[],
  accountById: ReadonlyMap<string, Account>,
): readonly Account[] {
  if (query.accounts.accountIds.length > 0) {
    const selected = new Set(query.accounts.accountIds);
    return accounts.filter((account) => selected.has(account.id));
  }

  if (query.accounts.accountId) {
    const root = accountById.get(query.accounts.accountId);
    if (!root) return [];
    if (!query.accounts.includeDescendants) return [root];
    const descendants = collectDescendantIds(root.id, accounts);
    const selected = new Set([root.id, ...descendants]);
    return accounts.filter((account) => selected.has(account.id));
  }

  return accounts;
}

function collectPostingAccountIds(
  accountId: string,
  accounts: readonly Account[],
  accountById: ReadonlyMap<string, Account>,
): string[] {
  const ids = [accountId, ...collectDescendantIds(accountId, accounts)];
  return ids.filter((id) => accountById.get(id)?.postingAllowed === true);
}

function collectDescendantIds(accountId: string, accounts: readonly Account[]): string[] {
  const children = new Map<string, string[]>();
  for (const account of accounts) {
    if (!account.parentId) continue;
    const list = children.get(account.parentId) ?? [];
    list.push(account.id);
    children.set(account.parentId, list);
  }

  const result: string[] = [];
  const stack = [...(children.get(accountId) ?? [])];
  while (stack.length > 0) {
    const current = stack.shift()!;
    result.push(current);
    stack.unshift(...(children.get(current) ?? []));
  }
  return result;
}

function factMatchesCommonQuery(
  fact: AccountingReportJournalLineFact,
  query: NormalizedAccountingReportQuery,
): boolean {
  if (!fact.isPostedFact || fact.companyId !== query.companyId) return false;
  if (query.branch.mode === "branch" && fact.branchId !== query.branch.branchId) return false;
  if (query.period.fiscalYearId && fact.fiscalYearId !== query.period.fiscalYearId) return false;
  if (query.period.fiscalPeriodId && fact.fiscalPeriodId !== query.period.fiscalPeriodId) return false;
  if (fact.voucherDate > query.period.toDate) return false;
  return dimensionsMatch(fact, query.dimensions);
}

function dimensionsMatch(
  fact: AccountingReportJournalLineFact,
  filters: readonly AccountingReportDimensionFilter[],
): boolean {
  if (filters.length === 0) return true;
  const assignments = fact.dimensions ?? [];
  return filters.every((filter) => assignments.some(
    (assignment) =>
      assignment.dimensionTypeId === filter.dimensionTypeId &&
      filter.memberIds.includes(assignment.memberId),
  ));
}

function validateAccountTree(
  accounts: readonly Account[],
  accountById: ReadonlyMap<string, Account>,
): void {
  for (const account of accounts) {
    if (account.parentId && !accountById.has(account.parentId)) {
      throw new AccountingReportBalanceError(
        "report.balance.invalid-account-tree",
        "درخت حساب برای محاسبه گزارش ناقص است.",
        { accountId: account.id, parentId: account.parentId },
      );
    }

    const visited = new Set<string>();
    let current: Account | undefined = account;
    while (current?.parentId) {
      if (visited.has(current.id)) {
        throw new AccountingReportBalanceError(
          "report.balance.invalid-account-tree",
          "درخت حساب دارای چرخه است.",
          { accountId: account.id },
        );
      }
      visited.add(current.id);
      current = accountById.get(current.parentId);
    }
  }
}

function validateFact(fact: AccountingReportJournalLineFact): void {
  if (
    !Number.isSafeInteger(fact.debit) ||
    !Number.isSafeInteger(fact.credit) ||
    fact.debit < 0 ||
    fact.credit < 0 ||
    (fact.debit > 0) === (fact.credit > 0)
  ) {
    throw new AccountingReportBalanceError(
      "report.balance.invalid-fact",
      "مبلغ ردیف گزارش حسابداری معتبر نیست.",
      { voucherId: fact.voucherId, journalLineId: fact.journalLineId },
    );
  }
}

function splitNet(net: number): AccountingReportBalanceSide {
  return Object.freeze(net >= 0
    ? { debit: net, credit: 0 }
    : { debit: 0, credit: Math.abs(net) });
}

function safeSubtract(left: number, right: number): number {
  const result = left - right;
  assertSafe(result);
  return result;
}

function safeAdd(left: number, right: number): number {
  const result = left + right;
  assertSafe(result);
  return result;
}

function assertSafe(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new AccountingReportBalanceError(
      "report.balance.overflow",
      "جمع مبالغ گزارش از محدوده عدد صحیح امن خارج شد.",
    );
  }
}
