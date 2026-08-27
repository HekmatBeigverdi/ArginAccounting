import {
  QUERY_PAGE_SIZE_DEFAULT,
  QUERY_PAGE_SIZE_MAXIMUM,
} from "@argin/platform";

export type AccountingReportBranchScope =
  | Readonly<{ mode: "all" }>
  | Readonly<{ mode: "branch"; branchId: string }>;

export interface AccountingReportPeriod {
  readonly fromDate: string;
  readonly toDate: string;
  readonly fiscalYearId?: string;
  readonly fiscalPeriodId?: string;
}

export interface AccountingReportAccountFilter {
  readonly accountId?: string;
  readonly includeDescendants?: boolean;
  readonly accountIds?: readonly string[];
}

export interface AccountingReportDimensionFilter {
  readonly dimensionTypeId: string;
  readonly memberIds: readonly string[];
}

export type AccountingReportSortDirection = "asc" | "desc";

export interface AccountingReportSort {
  readonly field: string;
  readonly direction?: AccountingReportSortDirection;
}

export interface AccountingReportPaging {
  readonly page?: number;
  readonly pageSize?: number;
}

export interface AccountingReportTraceContext {
  readonly voucherId?: string;
  readonly journalLineId?: string;
  readonly parentReport?: string;
}

export interface AccountingReportQuery {
  readonly companyId: string;
  readonly branch?: AccountingReportBranchScope;
  readonly period: AccountingReportPeriod;
  readonly accounts?: AccountingReportAccountFilter;
  readonly dimensions?: readonly AccountingReportDimensionFilter[];
  readonly includeZeroBalances?: boolean;
  readonly sort?: readonly AccountingReportSort[];
  readonly paging?: AccountingReportPaging;
  readonly trace?: AccountingReportTraceContext;
}

export interface NormalizedAccountingReportQuery {
  readonly companyId: string;
  readonly branch: AccountingReportBranchScope;
  readonly period: Readonly<Required<Pick<AccountingReportPeriod, "fromDate" | "toDate">> & {
    fiscalYearId?: string;
    fiscalPeriodId?: string;
  }>;
  readonly accounts: Readonly<{
    accountId?: string;
    includeDescendants: boolean;
    accountIds: readonly string[];
  }>;
  readonly dimensions: readonly Readonly<{
    dimensionTypeId: string;
    memberIds: readonly string[];
  }>[];
  readonly includeZeroBalances: boolean;
  readonly sort: readonly Readonly<{
    field: string;
    direction: AccountingReportSortDirection;
  }>[];
  readonly paging: Readonly<{
    page: number;
    pageSize: number;
    offset: number;
  }>;
  readonly trace?: Readonly<AccountingReportTraceContext>;
}

export type AccountingReportQueryErrorCode =
  | "report.invalid-query"
  | "report.invalid-period"
  | "report.invalid-branch"
  | "report.invalid-account-filter"
  | "report.invalid-dimension-filter"
  | "report.invalid-sort"
  | "report.invalid-paging";

export class AccountingReportQueryError extends Error {
  readonly code: AccountingReportQueryErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: AccountingReportQueryErrorCode,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "AccountingReportQueryError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export function normalizeAccountingReportQuery(
  query: AccountingReportQuery,
): NormalizedAccountingReportQuery {
  const companyId = requireText(query.companyId, "companyId");
  const fromDate = requireIsoDate(query.period.fromDate, "fromDate");
  const toDate = requireIsoDate(query.period.toDate, "toDate");
  if (fromDate > toDate) {
    throw new AccountingReportQueryError(
      "report.invalid-period",
      "تاریخ شروع گزارش نمی‌تواند بعد از تاریخ پایان باشد.",
      { fromDate, toDate },
    );
  }

  const fiscalYearId = optionalText(query.period.fiscalYearId);
  const fiscalPeriodId = optionalText(query.period.fiscalPeriodId);
  if (fiscalPeriodId && !fiscalYearId) {
    throw new AccountingReportQueryError(
      "report.invalid-period",
      "برای محدودکردن گزارش به دوره مالی، سال مالی نیز باید مشخص باشد.",
      { fiscalPeriodId },
    );
  }

  const branch = normalizeBranch(query.branch);
  const accounts = normalizeAccounts(query.accounts);
  const dimensions = normalizeDimensions(query.dimensions);
  const sort = normalizeSort(query.sort);
  const paging = normalizePaging(query.paging);
  const trace = normalizeTrace(query.trace);

  return Object.freeze({
    companyId,
    branch,
    period: Object.freeze({
      fromDate,
      toDate,
      ...(fiscalYearId ? { fiscalYearId } : {}),
      ...(fiscalPeriodId ? { fiscalPeriodId } : {}),
    }),
    accounts,
    dimensions,
    includeZeroBalances: query.includeZeroBalances ?? false,
    sort,
    paging,
    ...(trace ? { trace } : {}),
  });
}

function normalizeBranch(
  branch: AccountingReportBranchScope | undefined,
): AccountingReportBranchScope {
  if (!branch || branch.mode === "all") return Object.freeze({ mode: "all" });
  if (branch.mode !== "branch") {
    throw new AccountingReportQueryError(
      "report.invalid-branch",
      "محدوده شعبه گزارش معتبر نیست.",
    );
  }
  return Object.freeze({ mode: "branch", branchId: requireText(branch.branchId, "branchId") });
}

function normalizeAccounts(
  filter: AccountingReportAccountFilter | undefined,
): NormalizedAccountingReportQuery["accounts"] {
  const accountId = optionalText(filter?.accountId);
  const accountIds = uniqueTexts(filter?.accountIds ?? [], "accountIds");
  if (accountId && accountIds.length > 0) {
    throw new AccountingReportQueryError(
      "report.invalid-account-filter",
      "فیلتر حساب ریشه و فهرست حساب‌ها نباید هم‌زمان ارسال شوند.",
    );
  }
  return Object.freeze({
    ...(accountId ? { accountId } : {}),
    includeDescendants: accountId ? (filter?.includeDescendants ?? true) : false,
    accountIds: Object.freeze(accountIds),
  });
}

function normalizeDimensions(
  filters: readonly AccountingReportDimensionFilter[] | undefined,
): NormalizedAccountingReportQuery["dimensions"] {
  const seen = new Set<string>();
  return Object.freeze((filters ?? []).map((filter) => {
    const dimensionTypeId = requireText(filter.dimensionTypeId, "dimensionTypeId");
    if (seen.has(dimensionTypeId)) {
      throw new AccountingReportQueryError(
        "report.invalid-dimension-filter",
        "برای هر نوع بُعد حسابداری فقط یک فیلتر مجاز است.",
        { dimensionTypeId },
      );
    }
    seen.add(dimensionTypeId);
    const memberIds = uniqueTexts(filter.memberIds, "memberIds");
    if (memberIds.length === 0) {
      throw new AccountingReportQueryError(
        "report.invalid-dimension-filter",
        "فیلتر بُعد حسابداری باید حداقل یک عضو داشته باشد.",
        { dimensionTypeId },
      );
    }
    return Object.freeze({ dimensionTypeId, memberIds: Object.freeze(memberIds) });
  }));
}

function normalizeSort(
  sort: readonly AccountingReportSort[] | undefined,
): NormalizedAccountingReportQuery["sort"] {
  const seen = new Set<string>();
  return Object.freeze((sort ?? []).map((item) => {
    const field = requireText(item.field, "sort.field");
    if (seen.has(field)) {
      throw new AccountingReportQueryError(
        "report.invalid-sort",
        "هر ستون مرتب‌سازی فقط یک‌بار مجاز است.",
        { field },
      );
    }
    seen.add(field);
    const direction = item.direction ?? "asc";
    if (direction !== "asc" && direction !== "desc") {
      throw new AccountingReportQueryError("report.invalid-sort", "جهت مرتب‌سازی معتبر نیست.", { field });
    }
    return Object.freeze({ field, direction });
  }));
}

function normalizePaging(
  paging: AccountingReportPaging | undefined,
): NormalizedAccountingReportQuery["paging"] {
  const page = paging?.page ?? 1;
  const pageSize = paging?.pageSize ?? QUERY_PAGE_SIZE_DEFAULT;
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new AccountingReportQueryError("report.invalid-paging", "شماره صفحه باید عدد صحیح مثبت باشد.", { page });
  }
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > QUERY_PAGE_SIZE_MAXIMUM) {
    throw new AccountingReportQueryError(
      "report.invalid-paging",
      `اندازه صفحه باید بین ۱ و ${QUERY_PAGE_SIZE_MAXIMUM} باشد.`,
      { pageSize },
    );
  }
  return Object.freeze({ page, pageSize, offset: (page - 1) * pageSize });
}

function normalizeTrace(
  trace: AccountingReportTraceContext | undefined,
): Readonly<AccountingReportTraceContext> | undefined {
  if (!trace) return undefined;
  const voucherId = optionalText(trace.voucherId);
  const journalLineId = optionalText(trace.journalLineId);
  if (journalLineId && !voucherId) {
    throw new AccountingReportQueryError(
      "report.invalid-query",
      "شناسه ردیف سند بدون شناسه سند حسابداری قابل استفاده نیست.",
    );
  }
  const parentReport = optionalText(trace.parentReport);
  return Object.freeze({
    ...(voucherId ? { voucherId } : {}),
    ...(journalLineId ? { journalLineId } : {}),
    ...(parentReport ? { parentReport } : {}),
  });
}

function uniqueTexts(values: readonly string[], field: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = requireText(value, field);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new AccountingReportQueryError("report.invalid-query", "مقدار الزامی گزارش وارد نشده است.", { field });
  }
  return normalized;
}

function optionalText(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function requireIsoDate(value: string, field: string): string {
  const normalized = requireText(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new AccountingReportQueryError("report.invalid-period", "تاریخ گزارش باید ISO و به قالب YYYY-MM-DD باشد.", { field });
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new AccountingReportQueryError("report.invalid-period", "تاریخ گزارش معتبر نیست.", { field });
  }
  return normalized;
}

export type {
  AccountingReportAccountBalanceRow,
  AccountingReportBalanceErrorCode,
  AccountingReportBalanceSide,
  AccountingReportJournalLineFact,
} from "./reporting-balance.ts";
export {
  AccountingReportBalanceError,
  calculateAccountBalanceTurnover,
} from "./reporting-balance.ts";
