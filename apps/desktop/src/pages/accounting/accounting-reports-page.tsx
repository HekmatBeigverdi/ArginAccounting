import { useEffect, useMemo, useState } from "react";

import type {
  AccountingDimensionReportsResult,
} from "@argin/accounting/dimension-reports";
import type { GeneralLedgerResult } from "@argin/accounting/general-ledger";
import type { JournalReportResult } from "@argin/accounting/journal-report";
import type { AccountingReportQueryService } from "@argin/accounting/reporting-application";
import type { SubsidiaryLedgerResult } from "@argin/accounting/subsidiary-ledger";
import type { TrialBalanceResult } from "@argin/accounting/trial-balance";
import { accountingReportPermissions } from "@argin/accounting/accounting-report-permissions";
import { getDesktopDatabase } from "@argin/database-tauri";

import { useActiveContext } from "../../app/providers/active-context-provider";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { Feedback } from "../../components/feedback";
import { Page } from "../../components/layout";
import { createAccountingReportServices } from "../../composition/accounting/create-accounting-report-services";

import "./accounting-workspace.css";
import "./accounting-reports-page.css";

type ReportView = "trial" | "general" | "subsidiary" | "journal" | "dimensions";
type ReportData = TrialBalanceResult | GeneralLedgerResult | SubsidiaryLedgerResult | JournalReportResult | AccountingDimensionReportsResult;

const tabs: readonly [ReportView, string, string][] = [
  ["trial", "تراز آزمایشی", accountingReportPermissions.viewTrialBalance],
  ["general", "دفتر کل", accountingReportPermissions.viewGeneralLedger],
  ["subsidiary", "دفتر معین", accountingReportPermissions.viewSubsidiaryLedger],
  ["journal", "دفتر روزنامه", accountingReportPermissions.viewJournal],
  ["dimensions", "گزارش ابعاد", accountingReportPermissions.viewDimensions],
];

export function AccountingReportsPage() {
  const { session } = useAuthSession();
  const context = useActiveContext();
  const permissions = useMemo(() => new Set(session?.user.permissions ?? []), [session]);
  const can = (permission: string) => permissions.has("system.full-access") || permissions.has(permission);
  const visibleTabs = tabs.filter(([, , permission]) => can(permission));
  const [view, setView] = useState<ReportView>(visibleTabs[0]?.[0] ?? "trial");
  const [branchMode, setBranchMode] = useState<"all" | "branch">("branch");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [service, setService] = useState<AccountingReportQueryService | null>(null);
  const [data, setData] = useState<ReportData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void getDesktopDatabase()
      .then((database) => createAccountingReportServices({ database, session }).queries)
      .then(setService)
      .catch((reason: unknown) => setError(getErrorMessage(reason)));
  }, [session]);

  useEffect(() => {
    if (!context.activeFiscalYear) return;
    setFromDate(context.activeFiscalYear.startDate);
    setToDate(context.activeFiscalYear.endDate);
  }, [context.activeFiscalYear]);

  useEffect(() => {
    if (!visibleTabs.some(([candidate]) => candidate === view)) {
      setView(visibleTabs[0]?.[0] ?? "trial");
    }
  }, [view, visibleTabs]);

  async function runReport(): Promise<void> {
    if (!service || !context.companyId || !fromDate || !toDate) return;
    setBusy(true);
    setError("");
    setData(null);
    const report = {
      companyId: context.companyId,
      branch: branchMode === "all"
        ? ({ mode: "all" } as const)
        : ({ mode: "branch", branchId: context.branchId } as const),
      period: {
        fromDate,
        toDate,
        ...(context.fiscalYearId ? { fiscalYearId: context.fiscalYearId } : {}),
      },
      paging: { page: 1, pageSize: 200 },
    };
    try {
      switch (view) {
        case "trial": setData(await service.trialBalance({ report, mode: 6 })); break;
        case "general": setData(await service.generalLedger({ report })); break;
        case "subsidiary": setData(await service.subsidiaryLedger({ report })); break;
        case "journal": setData((await service.journal({ report })).result); break;
        case "dimensions": setData(await service.dimensions({ report })); break;
      }
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  if (visibleTabs.length === 0) {
    return <Page className="accounting-workspace reports-page" lang="fa" dir="rtl"><Feedback tone="error">شما مجوز مشاهده گزارش‌های حسابداری را ندارید.</Feedback></Page>;
  }

  return (
    <Page className="accounting-workspace reports-page" lang="fa" dir="rtl">
      <header className="accounting-workspace__header reports-header">
        <div>
          <p className="accounting-workspace__eyebrow">حسابداری / گزارش‌ها</p>
          <h1>مرکز گزارش‌های حسابداری</h1>
          <p>گزارش‌های قطعی مبتنی بر اسناد ثبت‌شده با نمایش فشرده و قابل تطبیق</p>
        </div>
        <div className="reports-context" aria-label="زمینه گزارش">
          <span>{context.activeCompany?.legalName ?? "بدون شرکت"}</span>
          <span>{context.activeFiscalYear?.title ?? "بدون سال مالی"}</span>
        </div>
      </header>

      <nav className="accounting-workspace__tabs" aria-label="انواع گزارش حسابداری">
        {visibleTabs.map(([id, label]) => (
          <button key={id} type="button" aria-current={view === id ? "page" : undefined} onClick={() => { setView(id); setData(null); setError(""); }}>
            {label}
          </button>
        ))}
      </nav>

      <section className="reports-filterbar" aria-label="فیلتر گزارش">
        <label>از تاریخ<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label>تا تاریخ<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        <label>دامنه شعب<select value={branchMode} onChange={(event) => setBranchMode(event.target.value as "all" | "branch")}><option value="branch">شعبه جاری</option><option value="all">همه شعب مجاز</option></select></label>
        {branchMode === "branch" && <label>شعبه<select value={context.branchId} onChange={(event) => context.setBranchId(event.target.value)}>{context.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>}
        <button className="ui-button" type="button" disabled={busy || !service || !context.companyId || (branchMode === "branch" && !context.branchId)} onClick={() => void runReport()}>{busy ? "در حال تهیه…" : "نمایش گزارش"}</button>
      </section>

      {context.error && <Feedback tone="error">{context.error}</Feedback>}
      {error && <Feedback tone="error">{error}</Feedback>}
      {busy && <div className="reports-state" role="status">در حال محاسبه و بارگذاری گزارش…</div>}
      {!busy && !error && data === null && <div className="reports-state">فیلترها را بررسی کنید و «نمایش گزارش» را بزنید.</div>}
      {!busy && data !== null && <ReportSurface view={view} data={data} />}
    </Page>
  );
}

function ReportSurface({ view, data }: { view: ReportView; data: ReportData }) {
  switch (view) {
    case "trial": return <TrialBalanceTable result={data as TrialBalanceResult} />;
    case "general": return <GeneralLedgerTable result={data as GeneralLedgerResult} />;
    case "subsidiary": return <SubsidiaryTable result={data as SubsidiaryLedgerResult} />;
    case "journal": return <JournalTable result={data as JournalReportResult} />;
    case "dimensions": return <DimensionTable result={data as AccountingDimensionReportsResult} />;
  }
}

function TrialBalanceTable({ result }: { result: TrialBalanceResult }) {
  if (result.rows.length === 0) return <EmptyReport />;
  return <div className="accounting-workspace__data-surface"><table className="ui-table reports-table"><thead><tr><th>کد</th><th>حساب</th><th>افتتاحیه بدهکار</th><th>افتتاحیه بستانکار</th><th>گردش بدهکار</th><th>گردش بستانکار</th><th>مانده بدهکار</th><th>مانده بستانکار</th></tr></thead><tbody>{result.rows.map((row) => <tr key={row.accountId}><td>{row.accountCode}</td><td>{row.accountName}</td><Amount value={row.openingDebit} /><Amount value={row.openingCredit} /><Amount value={row.periodDebit} /><Amount value={row.periodCredit} /><Amount value={row.endingDebit} /><Amount value={row.endingCredit} /></tr>)}</tbody><tfoot><tr><th colSpan={2}>جمع</th><Amount value={result.totals.openingDebit} tag="th" /><Amount value={result.totals.openingCredit} tag="th" /><Amount value={result.totals.periodDebit} tag="th" /><Amount value={result.totals.periodCredit} tag="th" /><Amount value={result.totals.endingDebit} tag="th" /><Amount value={result.totals.endingCredit} tag="th" /></tr></tfoot></table></div>;
}

function GeneralLedgerTable({ result }: { result: GeneralLedgerResult }) {
  if (result.sections.length === 0) return <EmptyReport />;
  return <div className="reports-stack">{result.sections.map((section) => <section className="reports-section" key={section.accountId}><header><strong>{section.accountCode} — {section.accountName}</strong><span>مانده پایان: {formatSigned(section.endingNet)}</span></header><div className="accounting-workspace__data-surface"><table className="ui-table reports-table"><thead><tr><th>تاریخ</th><th>سند</th><th>شرح</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead><tbody>{section.movements.map((row) => <tr key={`${row.voucherId}:${row.journalLineId}`}><td>{toSolar(row.voucherDate)}</td><td>{row.voucherNumber}</td><td>{row.description ?? "—"}</td><Amount value={row.debit} /><Amount value={row.credit} /><td className="reports-number">{formatSigned(row.runningNet)}</td></tr>)}</tbody></table></div></section>)}</div>;
}

function SubsidiaryTable({ result }: { result: SubsidiaryLedgerResult }) {
  if (result.accounts.length === 0) return <EmptyReport />;
  return <div className="accounting-workspace__data-surface"><table className="ui-table reports-table"><thead><tr><th>کد</th><th>حساب معین</th><th>افتتاحیه</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th><th>تعداد ردیف</th></tr></thead><tbody>{result.accounts.map((section) => <tr key={section.accountId}><td>{section.accountCode}</td><td>{section.accountName}</td><td className="reports-number">{formatSigned(section.turnover.openingNet)}</td><Amount value={section.turnover.periodDebit} /><Amount value={section.turnover.periodCredit} /><td className="reports-number">{formatSigned(section.turnover.endingNet)}</td><td>{formatNumber(section.turnover.movementCount)}</td></tr>)}</tbody></table></div>;
}

function JournalTable({ result }: { result: JournalReportResult }) {
  if (result.rows.length === 0) return <EmptyReport />;
  return <div className="accounting-workspace__data-surface"><table className="ui-table reports-table"><thead><tr><th>تاریخ</th><th>شماره سند</th><th>کد حساب</th><th>حساب</th><th>شرح</th><th>ابعاد</th><th>بدهکار</th><th>بستانکار</th></tr></thead><tbody>{result.rows.map((row) => <tr key={`${row.voucherId}:${row.journalLineId}`}><td>{toSolar(row.voucherDate)}</td><td>{row.voucherNumber}</td><td>{row.accountCode}</td><td>{row.accountName}</td><td>{row.description ?? "—"}</td><td>{row.dimensions.map((item) => `${item.dimensionTypeId}:${item.memberId}`).join("، ") || "—"}</td><Amount value={row.debit} /><Amount value={row.credit} /></tr>)}</tbody><tfoot><tr><th colSpan={6}>جمع</th><Amount value={result.totals.debit} tag="th" /><Amount value={result.totals.credit} tag="th" /></tr></tfoot></table></div>;
}

function DimensionTable({ result }: { result: AccountingDimensionReportsResult }) {
  if (result.byMember.length === 0) return <EmptyReport />;
  return <div className="accounting-workspace__data-surface"><table className="ui-table reports-table"><thead><tr><th>نوع بُعد</th><th>کد عضو</th><th>عضو</th><th>افتتاحیه</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead><tbody>{result.byMember.map((row) => <tr key={`${row.dimensionTypeId}:${row.memberId}`}><td>{row.dimensionTypeName}</td><td>{row.memberCode}</td><td>{row.memberName}</td><td className="reports-number">{formatSigned(row.openingNet)}</td><Amount value={row.periodDebit} /><Amount value={row.periodCredit} /><td className="reports-number">{formatSigned(row.endingNet)}</td></tr>)}</tbody></table></div>;
}

function EmptyReport() { return <div className="reports-state">در محدوده انتخاب‌شده داده‌ای برای نمایش وجود ندارد.</div>; }
function Amount({ value, tag = "td" }: { value: number; tag?: "td" | "th" }) { const Tag = tag; return <Tag className="reports-number">{value === 0 ? "—" : formatNumber(value)}</Tag>; }
function formatNumber(value: number) { return new Intl.NumberFormat("fa-IR").format(value); }
function formatSigned(value: number) { if (value === 0) return "—"; return `${formatNumber(Math.abs(value))} ${value > 0 ? "بد" : "بس"}`; }
function toSolar(value: string) { return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function getErrorMessage(reason: unknown) { if (typeof reason === "object" && reason && "code" in reason) { const code = String((reason as { code?: unknown }).code); if (code === "report.unauthorized") return "مجوز مشاهده این گزارش را ندارید."; if (code === "report.scope-denied") return "این گزارش خارج از محدوده شرکت یا شعب مجاز شماست."; } return reason instanceof Error ? reason.message : "تهیه گزارش حسابداری با خطا مواجه شد."; }
