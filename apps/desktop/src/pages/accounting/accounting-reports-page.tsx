import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { accountingReportPermissions } from "@argin/accounting/accounting-report-permissions";
import type { AccountingDimensionReportsResult } from "@argin/accounting/dimension-reports";
import type { GeneralLedgerResult } from "@argin/accounting/general-ledger";
import type { JournalReportResult } from "@argin/accounting/journal-report";
import type { AccountingReportQuery } from "@argin/accounting/reporting";
import type { SubsidiaryLedgerResult } from "@argin/accounting/subsidiary-ledger";
import type { TrialBalanceResult } from "@argin/accounting/trial-balance";
import { getDesktopDatabase } from "@argin/database-tauri";

import { useActiveContext } from "../../app/providers/active-context-provider";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { Feedback } from "../../components/feedback";
import { Page } from "../../components/layout";
import { useAccountingServices } from "../../composition/accounting/accounting-provider";
import {
  createAccountingReportServices,
  type AccountingReportDesktopServices,
} from "../../composition/accounting/create-accounting-report-services";
import {
  createAccountingReportExportDocument,
  downloadAccountingReportExcel,
  openAccountingReportPrintPreview,
} from "../../features/accounting/accounting-report-export";
import {
  AccountingReportFilters,
  type AccountingReportFilterAccountOption,
  type AccountingReportFilterDimensionMemberOption,
  type AccountingReportFilterDimensionTypeOption,
  type AccountingReportFilterState,
} from "../../features/accounting/accounting-report-filters";
import { flattenAccountTree } from "../../features/accounting/chart-of-accounts-presenter";

import "./accounting-workspace.css";
import "./accounting-reports-page.css";

type ReportView = "trial" | "general" | "subsidiary" | "journal" | "dimensions";
type ReportData =
  | TrialBalanceResult
  | GeneralLedgerResult
  | SubsidiaryLedgerResult
  | JournalReportResult
  | AccountingDimensionReportsResult;

type ExportAction = "preview" | "excel" | "pdf";

interface ExecutedReport {
  readonly view: ReportView;
  readonly query: AccountingReportQuery;
}

interface ReportSurfaceProps {
  readonly view: ReportView;
  readonly data: ReportData;
  readonly onAccountDrill: (accountId: string) => void;
  readonly onDimensionDrill: (dimensionTypeId: string, memberId: string) => void;
  readonly onSource: (voucherId: string, journalLineId?: string) => void;
}

const tabs: readonly [ReportView, string, string][] = [
  ["trial", "تراز آزمایشی", accountingReportPermissions.viewTrialBalance],
  ["general", "دفتر کل", accountingReportPermissions.viewGeneralLedger],
  ["subsidiary", "دفتر معین", accountingReportPermissions.viewSubsidiaryLedger],
  ["journal", "دفتر روزنامه", accountingReportPermissions.viewJournal],
  ["dimensions", "گزارش ابعاد", accountingReportPermissions.viewDimensions],
];

const emptyFilters: AccountingReportFilterState = Object.freeze({
  fromDate: "",
  toDate: "",
  branchMode: "branch",
  branchId: "",
  accountId: "",
  includeDescendants: false,
  dimensionTypeId: "",
  dimensionMemberId: "",
  includeZeroBalances: false,
});

export function AccountingReportsPage() {
  const navigate = useNavigate();
  const { session } = useAuthSession();
  const context = useActiveContext();
  const { chartOfAccounts, dimensions } = useAccountingServices();
  const permissionSet = useMemo(() => new Set(session?.user.permissions ?? []), [session]);
  const fullAccess = permissionSet.has("system.full-access");
  const can = (permission: string) => fullAccess || permissionSet.has(permission);
  const visibleTabs = useMemo(
    () => tabs.filter(([, , permission]) => fullAccess || permissionSet.has(permission)),
    [fullAccess, permissionSet],
  );
  const branchScope = useMemo(() => new Set(session?.user.branchIds ?? []), [session]);
  const allowedBranches = useMemo(
    () => context.branches.filter((branch) => fullAccess || branchScope.has(branch.id)),
    [branchScope, context.branches, fullAccess],
  );
  const activeCompanyBranches = useMemo(
    () => context.branches.filter((branch) => branch.status === "active"),
    [context.branches],
  );
  const canSelectAllBranches = fullAccess ||
    (activeCompanyBranches.length > 0 &&
      activeCompanyBranches.every((branch) => branchScope.has(branch.id)));

  const [view, setView] = useState<ReportView>(visibleTabs[0]?.[0] ?? "trial");
  const [filters, setFilters] = useState<AccountingReportFilterState>(emptyFilters);
  const [desktopServices, setDesktopServices] = useState<AccountingReportDesktopServices | null>(null);
  const [data, setData] = useState<ReportData | null>(null);
  const [executed, setExecuted] = useState<ExecutedReport | null>(null);
  const [accounts, setAccounts] = useState<readonly AccountingReportFilterAccountOption[]>([]);
  const [dimensionTypes, setDimensionTypes] = useState<readonly AccountingReportFilterDimensionTypeOption[]>([]);
  const [dimensionMembers, setDimensionMembers] = useState<readonly AccountingReportFilterDimensionMemberOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void getDesktopDatabase()
      .then((database) => createAccountingReportServices({ database, session }))
      .then(setDesktopServices)
      .catch((reason: unknown) => setError(getErrorMessage(reason)));
  }, [session]);

  useEffect(() => {
    const fiscalYear = context.activeFiscalYear;
    const fallbackBranch = allowedBranches.find((branch) => branch.id === context.branchId)?.id ??
      allowedBranches[0]?.id ?? "";
    setFilters((current) => Object.freeze({
      ...current,
      fromDate: fiscalYear?.startDate ?? current.fromDate,
      toDate: fiscalYear?.endDate ?? current.toDate,
      branchMode: current.branchMode === "all" && canSelectAllBranches ? "all" : "branch",
      branchId: allowedBranches.some((branch) => branch.id === current.branchId)
        ? current.branchId
        : fallbackBranch,
    }));
  }, [allowedBranches, canSelectAllBranches, context.activeFiscalYear, context.branchId]);

  useEffect(() => {
    let cancelled = false;
    if (!context.companyId) {
      setAccounts([]);
      setDimensionTypes([]);
      setDimensionMembers([]);
      return;
    }
    const tasks: Promise<void>[] = [];
    if (can("accounting.chart-of-accounts.view")) {
      tasks.push(chartOfAccounts.getAccountTree(context.companyId).then((tree) => {
        if (cancelled) return;
        setAccounts(flattenAccountTree(tree).map(({ account }) => Object.freeze({
          id: account.id,
          code: String(account.code),
          name: String(account.name),
        })));
      }));
    } else setAccounts([]);
    if (can("accounting.dimensions.view")) {
      tasks.push(Promise.all([
        dimensions.searchDimensionTypes({ companyId: context.companyId, pagination: { page: 1, pageSize: 200 } }),
        dimensions.searchMembers({ companyId: context.companyId, pagination: { page: 1, pageSize: 500 } }),
      ]).then(([types, members]) => {
        if (cancelled) return;
        setDimensionTypes(types.items.map((item) => Object.freeze({ id: item.id, code: item.code, name: item.name })));
        setDimensionMembers(members.items.map((item) => Object.freeze({
          id: item.id,
          dimensionTypeId: item.dimensionTypeId,
          code: item.code,
          name: item.name,
        })));
      }));
    } else {
      setDimensionTypes([]);
      setDimensionMembers([]);
    }
    void Promise.all(tasks).catch((reason: unknown) => {
      if (!cancelled) setError(getErrorMessage(reason));
    });
    return () => { cancelled = true; };
  }, [chartOfAccounts, context.companyId, dimensions, fullAccess, permissionSet]);

  useEffect(() => {
    if (!visibleTabs.some(([candidate]) => candidate === view)) {
      setView(visibleTabs[0]?.[0] ?? "trial");
      setData(null);
      setExecuted(null);
    }
  }, [view, visibleTabs]);

  function buildQuery(
    source: AccountingReportFilterState = filters,
    trace?: AccountingReportQuery["trace"],
  ): AccountingReportQuery {
    return Object.freeze({
      companyId: context.companyId,
      branch: source.branchMode === "all"
        ? Object.freeze({ mode: "all" as const })
        : Object.freeze({ mode: "branch" as const, branchId: source.branchId }),
      period: Object.freeze({
        fromDate: source.fromDate,
        toDate: source.toDate,
        ...(context.fiscalYearId ? { fiscalYearId: context.fiscalYearId } : {}),
      }),
      ...(source.accountId ? {
        accounts: Object.freeze({ accountId: source.accountId, includeDescendants: source.includeDescendants }),
      } : {}),
      ...(source.dimensionTypeId && source.dimensionMemberId ? {
        dimensions: Object.freeze([Object.freeze({
          dimensionTypeId: source.dimensionTypeId,
          memberIds: Object.freeze([source.dimensionMemberId]),
        })]),
      } : {}),
      includeZeroBalances: source.includeZeroBalances,
      paging: Object.freeze({ page: 1, pageSize: 200 }),
      ...(trace ? { trace: Object.freeze({ ...trace }) } : {}),
    });
  }

  async function executeReport(nextView: ReportView, query: AccountingReportQuery): Promise<void> {
    if (!desktopServices) return;
    setBusy(true);
    setError("");
    try {
      let nextData: ReportData;
      switch (nextView) {
        case "trial":
          nextData = await desktopServices.queries.trialBalance({ report: query, mode: 6 });
          break;
        case "general":
          nextData = await desktopServices.queries.generalLedger({ report: query });
          break;
        case "subsidiary":
          nextData = await desktopServices.queries.subsidiaryLedger({ report: query });
          break;
        case "journal":
          nextData = (await desktopServices.queries.journal({ report: query })).result;
          break;
        case "dimensions":
          nextData = await desktopServices.queries.dimensions({ report: query });
          break;
      }
      setView(nextView);
      setData(nextData);
      setExecuted(Object.freeze({ view: nextView, query }));
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function runReport(): Promise<void> {
    await executeReport(view, buildQuery());
  }

  async function drillToAccount(accountId: string, parentReport: string): Promise<void> {
    if (!executed) return;
    const query = Object.freeze({
      ...executed.query,
      accounts: Object.freeze({ accountId, includeDescendants: false }),
      trace: Object.freeze({ parentReport }),
    });
    await executeReport("general", query);
  }

  async function drillToDimension(dimensionTypeId: string, memberId: string): Promise<void> {
    if (!executed) return;
    const otherDimensions = (executed.query.dimensions ?? []).filter(
      (filter) => filter.dimensionTypeId !== dimensionTypeId,
    );
    const query = Object.freeze({
      ...executed.query,
      dimensions: Object.freeze([
        ...otherDimensions,
        Object.freeze({ dimensionTypeId, memberIds: Object.freeze([memberId]) }),
      ]),
      trace: Object.freeze({ parentReport: "dimensions" }),
    });
    await executeReport("journal", query);
  }

  function openJournalSource(voucherId: string, journalLineId?: string): void {
    if (!executed) return;
    const params = new URLSearchParams({
      companyId: executed.query.companyId,
      voucherId,
      ...(journalLineId ? { journalLineId } : {}),
      from: "accounting-reports",
    });
    navigate(`/accounting/journal-vouchers?${params.toString()}`);
  }

  async function exportReport(action: ExportAction): Promise<void> {
    if (!desktopServices || !executed || !data) return;
    setExportBusy(true);
    setError("");
    try {
      await desktopServices.authorizeExport(executed.query);
      const branchScope = executed.query.branch;
      const branchLabel = branchScope?.mode === "branch"
        ? allowedBranches.find((branch) => branch.id === branchScope.branchId)?.name ?? "شعبه انتخاب‌شده"
        : "همه شعب مجاز";
      const document = createAccountingReportExportDocument({
        kind: executed.view,
        data,
        companyName: context.activeCompany?.legalName ?? executed.query.companyId,
        fiscalYearTitle: context.activeFiscalYear?.title ?? executed.query.period.fiscalYearId ?? "—",
        branchLabel,
        fromDate: executed.query.period.fromDate,
        toDate: executed.query.period.toDate,
      });
      if (action === "excel") downloadAccountingReportExcel(document);
      else openAccountingReportPrintPreview(document, action === "pdf");
    } catch (reason) {
      setError(getExportErrorMessage(reason));
    } finally {
      setExportBusy(false);
    }
  }

  function selectView(nextView: ReportView): void {
    setView(nextView);
    setData(null);
    setExecuted(null);
    setError("");
  }

  function resetFilters(): void {
    const fiscalYear = context.activeFiscalYear;
    setFilters(Object.freeze({
      ...emptyFilters,
      fromDate: fiscalYear?.startDate ?? "",
      toDate: fiscalYear?.endDate ?? "",
      branchId: allowedBranches.find((branch) => branch.id === context.branchId)?.id ?? allowedBranches[0]?.id ?? "",
    }));
  }

  const reportUnavailable = busy || !desktopServices || !context.companyId || !filters.fromDate || !filters.toDate ||
    filters.fromDate > filters.toDate || (filters.branchMode === "branch" && !filters.branchId);
  const canExport = can(accountingReportPermissions.export);

  if (visibleTabs.length === 0) {
    return (
      <Page className="accounting-workspace reports-page" lang="fa" dir="rtl">
        <Feedback tone="error">شما مجوز مشاهده گزارش‌های حسابداری را ندارید.</Feedback>
      </Page>
    );
  }

  return (
    <Page className="accounting-workspace reports-page" lang="fa" dir="rtl">
      <header className="accounting-workspace__header reports-header">
        <div>
          <p className="accounting-workspace__eyebrow">حسابداری / گزارش‌ها</p>
          <h1>مرکز گزارش‌های حسابداری</h1>
          <p>گزارش‌های قطعی مبتنی بر اسناد ثبت‌شده، با فیلتر صریح، رهگیری و خروجی استاندارد</p>
        </div>
        <div className="reports-context" aria-label="زمینه گزارش">
          <span>{context.activeCompany?.legalName ?? "بدون شرکت"}</span>
          <span>{context.activeFiscalYear?.title ?? "بدون سال مالی"}</span>
        </div>
      </header>

      <nav className="accounting-workspace__tabs" aria-label="انواع گزارش حسابداری">
        {visibleTabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-current={view === id ? "page" : undefined}
            onClick={() => selectView(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <AccountingReportFilters
        value={filters}
        branches={allowedBranches}
        canSelectAllBranches={canSelectAllBranches}
        accounts={accounts}
        dimensionTypes={dimensionTypes}
        dimensionMembers={dimensionMembers}
        busy={busy}
        disabled={reportUnavailable}
        onChange={setFilters}
        onRun={() => void runReport()}
        onReset={resetFilters}
      />

      {executed && (
        <div className="reports-executed-context" role="status">
          <strong>مبنای گزارش جاری:</strong>
          <span>{toSolar(executed.query.period.fromDate)} تا {toSolar(executed.query.period.toDate)}</span>
          {executed.query.accounts?.accountId && <span>فیلتر حساب فعال</span>}
          {(executed.query.dimensions?.length ?? 0) > 0 && <span>فیلتر بُعد فعال</span>}
          {executed.query.trace?.parentReport && <span>Drill-down از {executed.query.trace.parentReport}</span>}
          {data && canExport && (
            <div className="reports-export-actions" aria-label="چاپ و خروجی گزارش">
              <button type="button" disabled={exportBusy} onClick={() => void exportReport("preview")}>پیش‌نمایش چاپ</button>
              <button type="button" disabled={exportBusy} onClick={() => void exportReport("excel")}>Excel</button>
              <button type="button" disabled={exportBusy} onClick={() => void exportReport("pdf")}>PDF</button>
            </div>
          )}
        </div>
      )}

      {context.error && <Feedback tone="error">{context.error}</Feedback>}
      {error && <Feedback tone="error">{error}</Feedback>}
      {busy && <div className="reports-state" role="status">در حال محاسبه و بارگذاری گزارش…</div>}
      {!busy && !error && data === null && <div className="reports-state">فیلترها را تنظیم کنید و «نمایش گزارش» را بزنید.</div>}
      {!busy && data !== null && (
        <ReportSurface
          view={view}
          data={data}
          onAccountDrill={(accountId) => void drillToAccount(accountId, view)}
          onDimensionDrill={(typeId, memberId) => void drillToDimension(typeId, memberId)}
          onSource={openJournalSource}
        />
      )}
    </Page>
  );
}

function ReportSurface({
  view,
  data,
  onAccountDrill,
  onDimensionDrill,
  onSource,
}: ReportSurfaceProps) {
  switch (view) {
    case "trial":
      return <TrialBalanceTable result={data as TrialBalanceResult} onDrill={onAccountDrill} />;
    case "general":
      return <GeneralLedgerTable result={data as GeneralLedgerResult} onSource={onSource} />;
    case "subsidiary":
      return <SubsidiaryTable result={data as SubsidiaryLedgerResult} onDrill={onAccountDrill} />;
    case "journal":
      return <JournalTable result={data as JournalReportResult} onSource={onSource} />;
    case "dimensions":
      return (
        <DimensionTable
          result={data as AccountingDimensionReportsResult}
          onDrill={onDimensionDrill}
        />
      );
  }
}

function TrialBalanceTable({ result, onDrill }: { result: TrialBalanceResult; onDrill(accountId: string): void }) {
  if (result.rows.length === 0) return <EmptyReport />;
  return (
    <div className="accounting-workspace__data-surface">
      <table className="ui-table reports-table">
        <thead>
          <tr>
            <th>کد</th>
            <th>حساب</th>
            <th>افتتاحیه بدهکار</th>
            <th>افتتاحیه بستانکار</th>
            <th>گردش بدهکار</th>
            <th>گردش بستانکار</th>
            <th>مانده بدهکار</th>
            <th>مانده بستانکار</th>
            <th>عملیات</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row) => (
            <tr key={row.accountId}>
              <td>{row.accountCode}</td>
              <td>{row.accountName}</td>
              <Amount value={row.openingDebit} />
              <Amount value={row.openingCredit} />
              <Amount value={row.periodDebit} />
              <Amount value={row.periodCredit} />
              <Amount value={row.endingDebit} />
              <Amount value={row.endingCredit} />
              <td>
                <TraceButton onClick={() => onDrill(row.accountId)}>گردش حساب</TraceButton>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={2}>جمع</th>
            <Amount value={result.totals.openingDebit} tag="th" />
            <Amount value={result.totals.openingCredit} tag="th" />
            <Amount value={result.totals.periodDebit} tag="th" />
            <Amount value={result.totals.periodCredit} tag="th" />
            <Amount value={result.totals.endingDebit} tag="th" />
            <Amount value={result.totals.endingCredit} tag="th" />
            <th />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function GeneralLedgerTable({ result, onSource }: { result: GeneralLedgerResult; onSource(voucherId: string, journalLineId?: string): void }) {
  if (result.sections.length === 0) return <EmptyReport />;
  return (
    <div className="reports-stack">
      {result.sections.map((section) => (
        <section className="reports-section" key={section.accountId}>
          <header>
            <strong>{section.accountCode} — {section.accountName}</strong>
            <span>مانده پایان: {formatSigned(section.endingNet)}</span>
          </header>
          <div className="accounting-workspace__data-surface">
            <table className="ui-table reports-table">
              <thead>
                <tr>
                  <th>تاریخ</th>
                  <th>سند</th>
                  <th>شرح</th>
                  <th>بدهکار</th>
                  <th>بستانکار</th>
                  <th>مانده</th>
                  <th>منبع</th>
                </tr>
              </thead>
              <tbody>
                {section.movements.map((row) => (
                  <tr key={`${row.voucherId}:${row.journalLineId}`}>
                    <td>{toSolar(row.voucherDate)}</td>
                    <td>{row.voucherNumber}</td>
                    <td>{row.description ?? "—"}</td>
                    <Amount value={row.debit} />
                    <Amount value={row.credit} />
                    <td className="reports-number">{formatSigned(row.runningNet)}</td>
                    <td>
                      <TraceButton onClick={() => onSource(row.voucherId, row.journalLineId)}>
                        مشاهده سند
                      </TraceButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function SubsidiaryTable({ result, onDrill }: { result: SubsidiaryLedgerResult; onDrill(accountId: string): void }) {
  if (result.accounts.length === 0) return <EmptyReport />;
  return (
    <div className="accounting-workspace__data-surface">
      <table className="ui-table reports-table">
        <thead>
          <tr>
            <th>کد</th>
            <th>حساب معین</th>
            <th>افتتاحیه</th>
            <th>بدهکار</th>
            <th>بستانکار</th>
            <th>مانده</th>
            <th>تعداد ردیف</th>
            <th>عملیات</th>
          </tr>
        </thead>
        <tbody>
          {result.accounts.map((section) => (
            <tr key={section.accountId}>
              <td>{section.accountCode}</td>
              <td>{section.accountName}</td>
              <td className="reports-number">{formatSigned(section.turnover.openingNet)}</td>
              <Amount value={section.turnover.periodDebit} />
              <Amount value={section.turnover.periodCredit} />
              <td className="reports-number">{formatSigned(section.turnover.endingNet)}</td>
              <td>{formatNumber(section.turnover.movementCount)}</td>
              <td>
                <TraceButton onClick={() => onDrill(section.accountId)}>گردش تفصیلی</TraceButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JournalTable({ result, onSource }: { result: JournalReportResult; onSource(voucherId: string, journalLineId?: string): void }) {
  if (result.rows.length === 0) return <EmptyReport />;
  return (
    <div className="accounting-workspace__data-surface">
      <table className="ui-table reports-table">
        <thead>
          <tr>
            <th>تاریخ</th>
            <th>شماره سند</th>
            <th>کد حساب</th>
            <th>حساب</th>
            <th>شرح</th>
            <th>ابعاد</th>
            <th>بدهکار</th>
            <th>بستانکار</th>
            <th>منبع</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row) => (
            <tr key={`${row.voucherId}:${row.journalLineId}`}>
              <td>{toSolar(row.voucherDate)}</td>
              <td>{row.voucherNumber}</td>
              <td>{row.accountCode}</td>
              <td>{row.accountName}</td>
              <td>{row.description ?? "—"}</td>
              <td>{formatDimensions(row.dimensions)}</td>
              <Amount value={row.debit} />
              <Amount value={row.credit} />
              <td>
                <TraceButton onClick={() => onSource(row.voucherId, row.journalLineId)}>
                  مشاهده سند
                </TraceButton>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={6}>جمع</th>
            <Amount value={result.totals.debit} tag="th" />
            <Amount value={result.totals.credit} tag="th" />
            <th />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function DimensionTable({ result, onDrill }: { result: AccountingDimensionReportsResult; onDrill(dimensionTypeId: string, memberId: string): void }) {
  if (result.byMember.length === 0) return <EmptyReport />;
  return (
    <div className="accounting-workspace__data-surface">
      <table className="ui-table reports-table">
        <thead>
          <tr>
            <th>نوع بُعد</th>
            <th>کد عضو</th>
            <th>عضو</th>
            <th>افتتاحیه</th>
            <th>بدهکار</th>
            <th>بستانکار</th>
            <th>مانده</th>
            <th>عملیات</th>
          </tr>
        </thead>
        <tbody>
          {result.byMember.map((row) => (
            <tr key={`${row.dimensionTypeId}:${row.memberId}`}>
              <td>{row.dimensionTypeName}</td>
              <td>{row.memberCode}</td>
              <td>{row.memberName}</td>
              <td className="reports-number">{formatSigned(row.openingNet)}</td>
              <Amount value={row.periodDebit} />
              <Amount value={row.periodCredit} />
              <td className="reports-number">{formatSigned(row.endingNet)}</td>
              <td>
                <TraceButton onClick={() => onDrill(row.dimensionTypeId, row.memberId)}>
                  اسناد مرتبط
                </TraceButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TraceButton({ children, onClick }: { children: string; onClick(): void }) {
  return <button className="reports-trace-button" type="button" onClick={onClick}>{children}</button>;
}

function EmptyReport() {
  return <div className="reports-state">در محدوده انتخاب‌شده داده‌ای برای نمایش وجود ندارد.</div>;
}

function Amount({ value, tag = "td" }: { value: number; tag?: "td" | "th" }) {
  const Tag = tag;
  return <Tag className="reports-number">{value === 0 ? "—" : formatNumber(value)}</Tag>;
}

function formatDimensions(dimensions: JournalReportResult["rows"][number]["dimensions"]): string {
  return dimensions.map((item) => `${item.dimensionTypeId}:${item.memberId}`).join("، ") || "—";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function formatSigned(value: number): string {
  if (value === 0) return "—";
  return `${formatNumber(Math.abs(value))} ${value > 0 ? "بد" : "بس"}`;
}

function toSolar(value: string): string {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00Z`));
}

function getErrorMessage(reason: unknown): string {
  if (typeof reason === "object" && reason && "code" in reason) {
    const code = String((reason as { code?: unknown }).code);
    if (code === "report.unauthorized") return "مجوز مشاهده این گزارش را ندارید.";
    if (code === "report.scope-denied") return "این گزارش خارج از محدوده شرکت یا شعب مجاز شماست.";
  }
  return reason instanceof Error ? reason.message : "تهیه گزارش حسابداری با خطا مواجه شد.";
}

function getExportErrorMessage(reason: unknown): string {
  if (typeof reason === "object" && reason && "code" in reason) {
    const code = String((reason as { code?: unknown }).code);
    if (code === "report.unauthorized") return "مجوز چاپ یا خروجی‌گرفتن از گزارش‌های حسابداری را ندارید.";
    if (code === "report.scope-denied") return "خروجی این گزارش خارج از محدوده شرکت یا شعب مجاز شماست.";
  }
  return reason instanceof Error ? reason.message : "ایجاد خروجی گزارش با خطا مواجه شد.";
}
