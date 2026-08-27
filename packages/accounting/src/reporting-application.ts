import type { Account } from "./domain/account.ts";
import type { AccountingDimensionMember } from "./domain/accounting-dimension-member.ts";
import type { AccountingDimensionType } from "./domain/accounting-dimension-type.ts";
import {
  createAccountingDimensionReports,
  type AccountingDimensionReportsResult,
} from "./dimension-reports.ts";
import {
  createGeneralLedger,
  type GeneralLedgerJournalLineFact,
  type GeneralLedgerResult,
} from "./general-ledger.ts";
import {
  createJournalReport,
  type JournalReportJournalLineFact,
  type JournalReportResult,
  type JournalReportRow,
} from "./journal-report.ts";
import {
  normalizeAccountingReportQuery,
  type AccountingReportQuery,
  type NormalizedAccountingReportQuery,
} from "./reporting.ts";
import type { AccountingReportJournalLineFact } from "./reporting-balance.ts";
import {
  createSubsidiaryLedger,
  type SubsidiaryLedgerResult,
} from "./subsidiary-ledger.ts";
import {
  createTrialBalance,
  type TrialBalanceColumnMode,
  type TrialBalanceResult,
} from "./trial-balance.ts";

export type AccountingReportKind =
  | "trial-balance"
  | "general-ledger"
  | "subsidiary-ledger"
  | "journal"
  | "dimensions";

export interface AccountingReportTraceIdentity {
  readonly voucherId: string;
  readonly journalLineId?: string;
}

export interface AccountingReportPage<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
  readonly hasPreviousPage: boolean;
  readonly hasNextPage: boolean;
}

export interface AccountingReportExecutionContext {
  readonly kind: AccountingReportKind;
  readonly query: NormalizedAccountingReportQuery;
}

export interface AccountingReportDataSnapshot {
  readonly accounts: readonly Account[];
  readonly balanceFacts: readonly AccountingReportJournalLineFact[];
  readonly ledgerFacts: readonly GeneralLedgerJournalLineFact[];
  readonly journalFacts: readonly JournalReportJournalLineFact[];
  readonly dimensionTypes: readonly AccountingDimensionType[];
  readonly dimensionMembers: readonly AccountingDimensionMember[];
}

export interface AccountingReportDataReader {
  read(context: AccountingReportExecutionContext): Promise<AccountingReportDataSnapshot>;
}

export interface TrialBalanceQueryRequest {
  readonly report: AccountingReportQuery;
  readonly mode?: TrialBalanceColumnMode;
}

export interface GeneralLedgerQueryRequest {
  readonly report: AccountingReportQuery;
}

export interface SubsidiaryLedgerQueryRequest {
  readonly report: AccountingReportQuery;
}

export interface JournalReportQueryRequest {
  readonly report: AccountingReportQuery;
}

export interface DimensionReportQueryRequest {
  readonly report: AccountingReportQuery;
}

export interface AccountingReportQueryService {
  trialBalance(request: TrialBalanceQueryRequest): Promise<TrialBalanceResult>;
  generalLedger(request: GeneralLedgerQueryRequest): Promise<GeneralLedgerResult>;
  subsidiaryLedger(request: SubsidiaryLedgerQueryRequest): Promise<SubsidiaryLedgerResult>;
  journal(request: JournalReportQueryRequest): Promise<Readonly<{
    result: JournalReportResult;
    page: AccountingReportPage<JournalReportRow>;
  }>>;
  dimensions(request: DimensionReportQueryRequest): Promise<AccountingDimensionReportsResult>;
}

export type AccountingReportApplicationErrorCode =
  | "report.application.read-failed"
  | "report.application.invalid-snapshot";

export class AccountingReportApplicationError extends Error {
  readonly code: AccountingReportApplicationErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: AccountingReportApplicationErrorCode,
    message: string,
    details: Record<string, unknown> = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AccountingReportApplicationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export class DefaultAccountingReportQueryService implements AccountingReportQueryService {
  constructor(private readonly reader: AccountingReportDataReader) {}

  async trialBalance(request: TrialBalanceQueryRequest): Promise<TrialBalanceResult> {
    const { query, snapshot } = await this.load("trial-balance", request.report);
    return createTrialBalance(query, snapshot.accounts, snapshot.balanceFacts, request.mode ?? 6);
  }

  async generalLedger(request: GeneralLedgerQueryRequest): Promise<GeneralLedgerResult> {
    const { query, snapshot } = await this.load("general-ledger", request.report);
    return createGeneralLedger(query, snapshot.accounts, snapshot.ledgerFacts);
  }

  async subsidiaryLedger(request: SubsidiaryLedgerQueryRequest): Promise<SubsidiaryLedgerResult> {
    const { query, snapshot } = await this.load("subsidiary-ledger", request.report);
    return createSubsidiaryLedger(query, snapshot.accounts, snapshot.ledgerFacts);
  }

  async journal(request: JournalReportQueryRequest): Promise<Readonly<{
    result: JournalReportResult;
    page: AccountingReportPage<JournalReportRow>;
  }>> {
    const { query, snapshot } = await this.load("journal", request.report);
    const result = createJournalReport(query, snapshot.accounts, snapshot.journalFacts);
    const page = paginate(result.rows, query.paging.page, query.paging.pageSize);
    return Object.freeze({ result, page });
  }

  async dimensions(request: DimensionReportQueryRequest): Promise<AccountingDimensionReportsResult> {
    const { query, snapshot } = await this.load("dimensions", request.report);
    return createAccountingDimensionReports(
      query,
      snapshot.accounts,
      snapshot.dimensionTypes,
      snapshot.dimensionMembers,
      snapshot.balanceFacts,
    );
  }

  private async load(
    kind: AccountingReportKind,
    report: AccountingReportQuery,
  ): Promise<Readonly<{
    query: NormalizedAccountingReportQuery;
    snapshot: AccountingReportDataSnapshot;
  }>> {
    const query = normalizeAccountingReportQuery(report);
    let snapshot: AccountingReportDataSnapshot;
    try {
      snapshot = await this.reader.read(Object.freeze({ kind, query }));
    } catch (cause) {
      throw new AccountingReportApplicationError(
        "report.application.read-failed",
        "خواندن داده گزارش حسابداری ناموفق بود.",
        { kind },
        { cause },
      );
    }
    validateSnapshot(snapshot, query.companyId);
    return Object.freeze({ query, snapshot });
  }
}

export function toAccountingReportTraceIdentity(
  voucherId: string,
  journalLineId?: string,
): AccountingReportTraceIdentity {
  const normalizedVoucherId = voucherId.trim();
  const normalizedJournalLineId = journalLineId?.trim();
  if (!normalizedVoucherId || (journalLineId !== undefined && !normalizedJournalLineId)) {
    throw new AccountingReportApplicationError(
      "report.application.invalid-snapshot",
      "شناسه رهگیری گزارش معتبر نیست.",
    );
  }
  return Object.freeze({
    voucherId: normalizedVoucherId,
    ...(normalizedJournalLineId ? { journalLineId: normalizedJournalLineId } : {}),
  });
}

function paginate<T>(items: readonly T[], page: number, pageSize: number): AccountingReportPage<T> {
  const totalItems = items.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
  const offset = (page - 1) * pageSize;
  return Object.freeze({
    items: Object.freeze(items.slice(offset, offset + pageSize)),
    page,
    pageSize,
    totalItems,
    totalPages,
    hasPreviousPage: page > 1 && totalPages > 0,
    hasNextPage: page < totalPages,
  });
}

function validateSnapshot(snapshot: AccountingReportDataSnapshot, companyId: string): void {
  if (!snapshot || !Array.isArray(snapshot.accounts) || !Array.isArray(snapshot.balanceFacts) ||
      !Array.isArray(snapshot.ledgerFacts) || !Array.isArray(snapshot.journalFacts) ||
      !Array.isArray(snapshot.dimensionTypes) || !Array.isArray(snapshot.dimensionMembers)) {
    throw new AccountingReportApplicationError(
      "report.application.invalid-snapshot",
      "داده خوانده‌شده برای گزارش حسابداری معتبر نیست.",
    );
  }

  const foreignAccount = snapshot.accounts.find((account) => account.companyId !== companyId);
  const foreignType = snapshot.dimensionTypes.find((type) => type.companyId !== companyId);
  const foreignMember = snapshot.dimensionMembers.find((member) => member.companyId !== companyId);
  if (foreignAccount || foreignType || foreignMember) {
    throw new AccountingReportApplicationError(
      "report.application.invalid-snapshot",
      "خواننده گزارش داده خارج از محدوده شرکت بازگرداند.",
      { companyId },
    );
  }
}
