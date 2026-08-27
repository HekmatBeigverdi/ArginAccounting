import type { Account } from "./domain/account.ts";
import type { AccountingDimensionMember } from "./domain/accounting-dimension-member.ts";
import type { AccountingDimensionType } from "./domain/accounting-dimension-type.ts";
import {
  accountingReportFactMatchesBaseScope,
  safeAccountingReportAdd,
  splitAccountingReportNet,
  validateAccountingReportFact,
  type AccountingReportBalanceSide,
  type AccountingReportJournalLineFact,
} from "./reporting-balance.ts";
import type { NormalizedAccountingReportQuery } from "./reporting.ts";

export interface AccountingDimensionBalanceRow {
  readonly dimensionTypeId: string;
  readonly dimensionTypeCode: string;
  readonly dimensionTypeName: string;
  readonly memberId: string;
  readonly memberCode: string;
  readonly memberName: string;
  readonly openingNet: number;
  readonly openingBalance: AccountingReportBalanceSide;
  readonly periodDebit: number;
  readonly periodCredit: number;
  readonly endingNet: number;
  readonly endingBalance: AccountingReportBalanceSide;
}

export interface AccountDimensionBalanceRow extends AccountingDimensionBalanceRow {
  readonly accountId: string;
  readonly accountCode: string;
  readonly accountName: string;
}

export interface AccountingDimensionReportsResult {
  readonly byMember: readonly AccountingDimensionBalanceRow[];
  readonly byAccountMember: readonly AccountDimensionBalanceRow[];
}

export type AccountingDimensionReportErrorCode =
  | "report.dimension.invalid-metadata"
  | "report.dimension.account-not-found";

export class AccountingDimensionReportError extends Error {
  readonly code: AccountingDimensionReportErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: AccountingDimensionReportErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "AccountingDimensionReportError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

interface MutableAggregate {
  dimensionTypeId: string;
  memberId: string;
  accountId?: string;
  openingNet: number;
  periodDebit: number;
  periodCredit: number;
}

export function createAccountingDimensionReports(
  query: NormalizedAccountingReportQuery,
  accounts: readonly Account[],
  dimensionTypes: readonly AccountingDimensionType[],
  dimensionMembers: readonly AccountingDimensionMember[],
  facts: readonly AccountingReportJournalLineFact[],
): AccountingDimensionReportsResult {
  const accountById = new Map(
    accounts
      .filter((account) => account.companyId === query.companyId)
      .map((account) => [account.id, account] as const),
  );
  const typeById = new Map(
    dimensionTypes
      .filter((type) => type.companyId === query.companyId)
      .map((type) => [type.id, type] as const),
  );
  const memberById = new Map(
    dimensionMembers
      .filter((member) => member.companyId === query.companyId)
      .map((member) => [member.id, member] as const),
  );

  const selectedPostingAccountIds = resolveSelectedPostingAccountIds(query, accounts, accountById);
  const byMember = new Map<string, MutableAggregate>();
  const byAccountMember = new Map<string, MutableAggregate>();

  for (const fact of facts) {
    if (!accountingReportFactMatchesBaseScope(fact, query)) continue;
    if (fact.voucherDate > query.period.toDate) continue;
    if (!selectedPostingAccountIds.has(fact.accountId)) continue;
    validateAccountingReportFact(fact);

    for (const assignment of fact.dimensions ?? []) {
      validateDimensionMetadata(assignment.dimensionTypeId, assignment.memberId, typeById, memberById);
      const memberKey = createKey(assignment.dimensionTypeId, assignment.memberId);
      const accountMemberKey = createKey(fact.accountId, assignment.dimensionTypeId, assignment.memberId);
      applyFact(byMember, memberKey, {
        dimensionTypeId: assignment.dimensionTypeId,
        memberId: assignment.memberId,
      }, fact, query);
      applyFact(byAccountMember, accountMemberKey, {
        accountId: fact.accountId,
        dimensionTypeId: assignment.dimensionTypeId,
        memberId: assignment.memberId,
      }, fact, query);
    }
  }

  const memberRows = [...byMember.values()]
    .map((aggregate) => projectDimensionRow(aggregate, typeById, memberById))
    .filter((row) => shouldInclude(row, query.includeZeroBalances))
    .sort(compareDimensionRows);

  const accountMemberRows = [...byAccountMember.values()]
    .map((aggregate) => {
      const account = aggregate.accountId ? accountById.get(aggregate.accountId) : undefined;
      if (!account) {
        throw new AccountingDimensionReportError(
          "report.dimension.account-not-found",
          "حساب گزارش بُعد حسابداری در محدوده شرکت پیدا نشد.",
          { accountId: aggregate.accountId },
        );
      }
      return Object.freeze({
        ...projectDimensionRow(aggregate, typeById, memberById),
        accountId: account.id,
        accountCode: String(account.code),
        accountName: String(account.name),
      });
    })
    .filter((row) => shouldInclude(row, query.includeZeroBalances))
    .sort(compareAccountDimensionRows);

  return Object.freeze({
    byMember: Object.freeze(memberRows),
    byAccountMember: Object.freeze(accountMemberRows),
  });
}

function applyFact(
  target: Map<string, MutableAggregate>,
  key: string,
  identity: Pick<MutableAggregate, "dimensionTypeId" | "memberId" | "accountId">,
  fact: AccountingReportJournalLineFact,
  query: NormalizedAccountingReportQuery,
): void {
  const current = target.get(key) ?? {
    ...identity,
    openingNet: 0,
    periodDebit: 0,
    periodCredit: 0,
  };

  if (fact.voucherDate < query.period.fromDate) {
    current.openingNet = safeAccountingReportAdd(
      current.openingNet,
      safeAccountingReportAdd(fact.debit, -fact.credit),
    );
  } else if (!query.period.fiscalPeriodId || fact.fiscalPeriodId === query.period.fiscalPeriodId) {
    current.periodDebit = safeAccountingReportAdd(current.periodDebit, fact.debit);
    current.periodCredit = safeAccountingReportAdd(current.periodCredit, fact.credit);
  }

  target.set(key, current);
}

function projectDimensionRow(
  aggregate: MutableAggregate,
  typeById: ReadonlyMap<string, AccountingDimensionType>,
  memberById: ReadonlyMap<string, AccountingDimensionMember>,
): AccountingDimensionBalanceRow {
  const type = typeById.get(aggregate.dimensionTypeId)!;
  const member = memberById.get(aggregate.memberId)!;
  const endingNet = safeAccountingReportAdd(
    aggregate.openingNet,
    safeAccountingReportAdd(aggregate.periodDebit, -aggregate.periodCredit),
  );
  return Object.freeze({
    dimensionTypeId: type.id,
    dimensionTypeCode: type.code,
    dimensionTypeName: type.name,
    memberId: member.id,
    memberCode: member.code,
    memberName: member.name,
    openingNet: aggregate.openingNet,
    openingBalance: splitAccountingReportNet(aggregate.openingNet),
    periodDebit: aggregate.periodDebit,
    periodCredit: aggregate.periodCredit,
    endingNet,
    endingBalance: splitAccountingReportNet(endingNet),
  });
}

function validateDimensionMetadata(
  dimensionTypeId: string,
  memberId: string,
  typeById: ReadonlyMap<string, AccountingDimensionType>,
  memberById: ReadonlyMap<string, AccountingDimensionMember>,
): void {
  const type = typeById.get(dimensionTypeId);
  const member = memberById.get(memberId);
  if (!type || !member || member.dimensionTypeId !== dimensionTypeId) {
    throw new AccountingDimensionReportError(
      "report.dimension.invalid-metadata",
      "اطلاعات نوع یا عضو بُعد حسابداری برای گزارش معتبر نیست.",
      { dimensionTypeId, memberId },
    );
  }
}

function resolveSelectedPostingAccountIds(
  query: NormalizedAccountingReportQuery,
  accounts: readonly Account[],
  accountById: ReadonlyMap<string, Account>,
): ReadonlySet<string> {
  const companyAccounts = accounts.filter((account) => account.companyId === query.companyId);
  if (query.accounts.accountIds.length > 0) {
    return new Set(query.accounts.accountIds.filter((id) => accountById.get(id)?.postingAllowed));
  }
  if (!query.accounts.accountId) {
    return new Set(companyAccounts.filter((account) => account.postingAllowed).map((account) => account.id));
  }

  const root = accountById.get(query.accounts.accountId);
  if (!root) return new Set();
  if (!query.accounts.includeDescendants) {
    return new Set(root.postingAllowed ? [root.id] : []);
  }

  const children = new Map<string, string[]>();
  for (const account of companyAccounts) {
    if (!account.parentId) continue;
    const list = children.get(account.parentId) ?? [];
    list.push(account.id);
    children.set(account.parentId, list);
  }
  const result = new Set<string>();
  const queue = [root.id];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (accountById.get(id)?.postingAllowed) result.add(id);
    queue.push(...(children.get(id) ?? []));
  }
  return result;
}

function shouldInclude(
  row: Pick<AccountingDimensionBalanceRow, "openingNet" | "periodDebit" | "periodCredit" | "endingNet">,
  includeZeroBalances: boolean,
): boolean {
  return includeZeroBalances ||
    row.openingNet !== 0 ||
    row.periodDebit !== 0 ||
    row.periodCredit !== 0 ||
    row.endingNet !== 0;
}

function compareDimensionRows(left: AccountingDimensionBalanceRow, right: AccountingDimensionBalanceRow): number {
  return compareText(left.dimensionTypeCode, right.dimensionTypeCode) ||
    compareText(left.memberCode, right.memberCode) ||
    compareText(left.memberId, right.memberId);
}

function compareAccountDimensionRows(left: AccountDimensionBalanceRow, right: AccountDimensionBalanceRow): number {
  return compareText(left.accountCode, right.accountCode) ||
    compareDimensionRows(left, right);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function createKey(...parts: readonly string[]): string {
  return parts.join("\u0000");
}
