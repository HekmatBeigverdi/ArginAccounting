import type { Account } from "./domain/account.ts";
import {
  createGeneralLedger,
  type GeneralLedgerJournalLineFact,
  type GeneralLedgerMovementRow,
} from "./general-ledger.ts";
import type {
  AccountingReportBalanceSide,
} from "./reporting-balance.ts";
import type { NormalizedAccountingReportQuery } from "./reporting.ts";

export interface SubsidiaryLedgerDimensionAssignment {
  readonly dimensionTypeId: string;
  readonly memberId: string;
}

export interface SubsidiaryLedgerMovementRow extends GeneralLedgerMovementRow {
  readonly dimensions: readonly SubsidiaryLedgerDimensionAssignment[];
}

export interface AccountTurnoverSummary {
  readonly accountId: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly openingNet: number;
  readonly openingBalance: AccountingReportBalanceSide;
  readonly periodDebit: number;
  readonly periodCredit: number;
  readonly endingNet: number;
  readonly endingBalance: AccountingReportBalanceSide;
  readonly movementCount: number;
}

export interface SubsidiaryLedgerAccountSection {
  readonly accountId: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly turnover: AccountTurnoverSummary;
  readonly movements: readonly SubsidiaryLedgerMovementRow[];
}

export interface SubsidiaryLedgerResult {
  readonly accounts: readonly SubsidiaryLedgerAccountSection[];
}

export function createSubsidiaryLedger(
  query: NormalizedAccountingReportQuery,
  accounts: readonly Account[],
  facts: readonly GeneralLedgerJournalLineFact[],
): SubsidiaryLedgerResult {
  const postingAccountIds = new Set(
    accounts
      .filter((account) => account.companyId === query.companyId && account.postingAllowed)
      .map((account) => account.id),
  );

  const ledger = createGeneralLedger(query, accounts, facts);
  const dimensionsByLine = new Map<string, readonly SubsidiaryLedgerDimensionAssignment[]>();

  for (const fact of facts) {
    const dimensions = Object.freeze(
      [...(fact.dimensions ?? [])]
        .map((item) => Object.freeze({
          dimensionTypeId: item.dimensionTypeId,
          memberId: item.memberId,
        }))
        .sort(compareDimensions),
    );
    dimensionsByLine.set(createFactKey(fact.voucherId, fact.journalLineId), dimensions);
  }

  const sections = ledger.sections
    .filter((section) => postingAccountIds.has(section.accountId))
    .map((section) => {
      const movements = section.movements.map((movement) => Object.freeze({
        ...movement,
        dimensions:
          dimensionsByLine.get(createFactKey(movement.voucherId, movement.journalLineId)) ??
          Object.freeze([]),
      }));

      const turnover = Object.freeze({
        accountId: section.accountId,
        accountCode: section.accountCode,
        accountName: section.accountName,
        openingNet: section.openingNet,
        openingBalance: section.openingBalance,
        periodDebit: section.periodDebit,
        periodCredit: section.periodCredit,
        endingNet: section.endingNet,
        endingBalance: section.endingBalance,
        movementCount: movements.length,
      });

      return Object.freeze({
        accountId: section.accountId,
        accountCode: section.accountCode,
        accountName: section.accountName,
        turnover,
        movements: Object.freeze(movements),
      });
    });

  return Object.freeze({ accounts: Object.freeze(sections) });
}

function compareDimensions(
  left: SubsidiaryLedgerDimensionAssignment,
  right: SubsidiaryLedgerDimensionAssignment,
): number {
  return compareText(left.dimensionTypeId, right.dimensionTypeId) ||
    compareText(left.memberId, right.memberId);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function createFactKey(voucherId: string, journalLineId: string): string {
  return `${voucherId}\u0000${journalLineId}`;
}
