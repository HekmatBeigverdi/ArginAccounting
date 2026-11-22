import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import type { JournalVoucherListItemDto } from "@argin/accounting/journal";

import { useActiveContext } from "../../app/providers/active-context-provider";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { Badge, DataTable } from "../../components/data-display";
import { Feedback } from "../../components/feedback";
import { Card, Page, Panel } from "../../components/layout";
import { useAccountingServices } from "../../composition/accounting/accounting-provider";
import {
  formatJournalRials,
  formatJournalVoucherDate,
} from "../../features/accounting/journal-voucher-presenter";
import salesIcon from "../../assets/argin-ui/dashboard-sales.svg";
import receiptsIcon from "../../assets/argin-ui/dashboard-receipts.svg";
import dueIcon from "../../assets/argin-ui/dashboard-due.svg";
import inventoryIcon from "../../assets/argin-ui/dashboard-inventory.svg";
import documentIcon from "../../assets/argin-ui/dashboard-document.svg";
import cartIcon from "../../assets/argin-ui/dashboard-cart.svg";
import stockIcon from "../../assets/argin-ui/dashboard-stock.svg";
import chartIcon from "../../assets/argin-ui/dashboard-chart.svg";

import "./dashboard-page.css";

const voucherStatusLabels: Record<string, string> = {
  draft: "پیش‌نویس",
  pending_approval: "در انتظار تأیید",
  approved: "تأییدشده",
  posted: "ثبت قطعی",
  reversed: "برگشت‌شده",
};

function voucherTone(status: string) {
  if (status === "posted" || status === "approved") return "success" as const;
  if (status === "pending_approval") return "warning" as const;
  if (status === "reversed") return "danger" as const;
  return "info" as const;
}

export function DashboardPage() {
  const context = useActiveContext();
  const { session } = useAuthSession();
  const { journals } = useAccountingServices();
  const [recentVouchers, setRecentVouchers] = useState<readonly JournalVoucherListItemDto[]>([]);
  const [journalError, setJournalError] = useState("");
  const [isLoadingJournals, setIsLoadingJournals] = useState(false);

  const permissions = useMemo(
    () => new Set(session?.user.permissions ?? []),
    [session],
  );
  const hasFullAccess = permissions.has("system.full-access");
  const canViewJournals = hasFullAccess || permissions.has("accounting.journal-vouchers.view");
  const canViewSales = hasFullAccess || permissions.has("sales.documents.view");
  const canViewPurchases = hasFullAccess || permissions.has("purchases.documents.view");
  const canViewAccountingReports = hasFullAccess || [
    "accounting.reports.trial-balance.view",
    "accounting.reports.general-ledger.view",
    "accounting.reports.subsidiary-ledger.view",
    "accounting.reports.journal.view",
    "accounting.reports.dimensions.view",
  ].some((permission) => permissions.has(permission));

  useEffect(() => {
    let cancelled = false;

    if (!context.companyId || !context.fiscalYearId || !canViewJournals) {
      setRecentVouchers([]);
      setJournalError("");
      setIsLoadingJournals(false);
      return;
    }

    setIsLoadingJournals(true);
    setJournalError("");
    void journals.list({
      companyId: context.companyId,
      fiscalYearId: context.fiscalYearId,
      ...(context.branchId ? { branchId: context.branchId } : {}),
      page: 1,
      pageSize: 5,
    })
      .then((page) => {
        if (!cancelled) setRecentVouchers(page.items);
      })
      .catch(() => {
        if (!cancelled) {
          setRecentVouchers([]);
          setJournalError("نمایش اسناد اخیر در حال حاضر امکان‌پذیر نیست.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingJournals(false);
      });

    return () => { cancelled = true; };
  }, [canViewJournals, context.branchId, context.companyId, context.fiscalYearId, journals]);

  const quickActions = [
    ...(canViewJournals ? [{ title: "ثبت سند حسابداری", description: "ثبت و پیگیری اسناد شرکت فعال", path: "/accounting/journal-vouchers", icon: documentIcon }] : []),
    ...(canViewSales ? [{ title: "صدور فاکتور فروش", description: "ایجاد و مدیریت اسناد فروش", path: "/sales/documents", icon: cartIcon }] : []),
    ...(canViewPurchases ? [{ title: "ثبت فاکتور خرید", description: "مدیریت خریدهای شرکت", path: "/purchases/documents", icon: stockIcon }] : []),
    ...(canViewAccountingReports ? [{ title: "گزارش‌های حسابداری", description: "مشاهده گزارش‌های مالی", path: "/accounting/reports", icon: chartIcon }] : []),
  ];

  const maxJournalAmount = Math.max(
    1,
    ...recentVouchers.map((voucher) => Math.max(Number(voucher.totalDebit.amount), Number(voucher.totalCredit.amount))),
  );

  if (context.isLoading) {
    return <Page className="dashboard-page" aria-busy="true"><Panel className="dashboard-page__loading">در حال آماده‌سازی داشبورد و زمینه کاری...</Panel></Page>;
  }

  return (
    <Page className="dashboard-page">
      <header className="dashboard-page__heading">
        <div>
          <h2>نمای کلی {context.activeCompany ? `شرکت ${context.activeCompany.legalName}` : "شرکت"}</h2>
          <p>مرور اطلاعات شرکت، فعالیت‌های مالی و دسترسی سریع به عملیات روزانه.</p>
        </div>
        {canViewJournals ? <Link className="ui-button ui-button--primary dashboard-page__new-button" to="/accounting/journal-vouchers"><span aria-hidden="true">＋</span> سند جدید</Link> : null}
      </header>

      {context.error ? <Feedback tone="error">{context.error}</Feedback> : null}
      {!context.activeCompany ? (
        <Feedback tone="info">
          هنوز شرکتی ثبت نشده است. برای شروع، اطلاعات شرکت و دفتر مرکزی را تعریف کنید.
          {" "}<Link to="/company/setup">تعریف شرکت</Link>
        </Feedback>
      ) : null}
      {journalError ? <Feedback tone="warning">{journalError}</Feedback> : null}

      <section className="dashboard-page__metrics" aria-label="خلاصهٔ زمینهٔ فعال">
        <Card className="dashboard-page__metric dashboard-page__metric--green">
          <div className="dashboard-page__metric-icon"><img src={salesIcon} alt="" aria-hidden="true" /></div>
          <span>شرکت‌های ثبت‌شده</span>
          <strong>{context.companies.length.toLocaleString("fa-IR")}</strong>
          <small>{context.activeCompany?.legalName ?? "شرکت فعالی انتخاب نشده"}</small>
        </Card>
        <Card className="dashboard-page__metric dashboard-page__metric--blue">
          <div className="dashboard-page__metric-icon"><img src={receiptsIcon} alt="" aria-hidden="true" /></div>
          <span>شعب شرکت فعال</span>
          <strong>{context.branches.length.toLocaleString("fa-IR")}</strong>
          <small>{context.activeBranch?.name ?? "شعبه‌ای انتخاب نشده"}</small>
        </Card>
        <Card className="dashboard-page__metric dashboard-page__metric--amber">
          <div className="dashboard-page__metric-icon"><img src={dueIcon} alt="" aria-hidden="true" /></div>
          <span>سال‌های مالی</span>
          <strong>{context.fiscalYears.length.toLocaleString("fa-IR")}</strong>
          <small>{context.activeFiscalYear?.title ?? "سال مالی انتخاب نشده"}</small>
        </Card>
        <Card className="dashboard-page__metric dashboard-page__metric--mint">
          <div className="dashboard-page__metric-icon"><img src={inventoryIcon} alt="" aria-hidden="true" /></div>
          <span>اسناد حسابداری اخیر</span>
          <strong>{canViewJournals && !isLoadingJournals ? recentVouchers.length.toLocaleString("fa-IR") : "—"}</strong>
          <small>{canViewJournals ? "در زمینهٔ کاری فعال" : "بدون مجوز مشاهده"}</small>
        </Card>
      </section>

      <section className="dashboard-page__middle">
        <Panel className="dashboard-page__chart-panel">
          <header className="dashboard-page__panel-heading">
            <div><h3>گردش اسناد حسابداری</h3><p>مقایسهٔ بدهکار و بستانکار در اسناد اخیر</p></div>
            <div className="dashboard-page__legend"><span><i className="dashboard-page__legend-dot dashboard-page__legend-dot--debit" />بدهکار</span><span><i className="dashboard-page__legend-dot dashboard-page__legend-dot--credit" />بستانکار</span></div>
          </header>
          {isLoadingJournals ? <p className="dashboard-page__empty">در حال دریافت داده‌های مالی...</p> : null}
          {!isLoadingJournals && !canViewJournals ? <p className="dashboard-page__empty">برای نمایش گردش اسناد، مجوز مشاهدهٔ اسناد حسابداری لازم است.</p> : null}
          {!isLoadingJournals && canViewJournals && recentVouchers.length === 0 ? <p className="dashboard-page__empty">در این زمینه هنوز سندی ثبت نشده است.</p> : null}
          {recentVouchers.length > 0 ? (
            <div className="dashboard-page__chart" role="img" aria-label="مقایسهٔ مبالغ بدهکار و بستانکار اسناد اخیر">
              {recentVouchers.slice(0, 7).map((voucher) => {
                const debit = Number(voucher.totalDebit.amount);
                const credit = Number(voucher.totalCredit.amount);
                return (
                  <div className="dashboard-page__chart-column" key={voucher.id} title={`${voucher.number} · بدهکار ${formatJournalRials(voucher.totalDebit.amount)} · بستانکار ${formatJournalRials(voucher.totalCredit.amount)}`}>
                    <div className="dashboard-page__chart-bars">
                      <span className="dashboard-page__bar dashboard-page__bar--debit" style={{ height: `${Math.max(4, (debit / maxJournalAmount) * 100)}%` }} />
                      <span className="dashboard-page__bar dashboard-page__bar--credit" style={{ height: `${Math.max(4, (credit / maxJournalAmount) * 100)}%` }} />
                    </div>
                    <small dir="ltr">{voucher.number}</small>
                  </div>
                );
              })}
            </div>
          ) : null}
        </Panel>

        <Panel className="dashboard-page__quick-panel">
          <header className="dashboard-page__panel-heading"><div><h3>دسترسی سریع</h3><p>عملیات پرکاربرد</p></div></header>
          <div className="dashboard-page__quick-list">
            {quickActions.map((action) => (
              <Link className="dashboard-page__quick-action" key={action.path} to={action.path}>
                <span className="dashboard-page__quick-icon"><img src={action.icon} alt="" aria-hidden="true" /></span>
                <span><strong>{action.title}</strong><small>{action.description}</small></span>
                <span className="dashboard-page__quick-arrow" aria-hidden="true">‹</span>
              </Link>
            ))}
            {quickActions.length === 0 ? <p className="dashboard-page__empty">برای عملیات سریع، مجوز لازم در حساب کاربری ثبت نشده است.</p> : null}
          </div>
        </Panel>
      </section>

      <Panel className="dashboard-page__activity">
        <div className="dashboard-page__activity-heading">
          <h3>آخرین اسناد حسابداری</h3>
          {canViewJournals ? <Link to="/accounting/journal-vouchers">مشاهده همه</Link> : null}
        </div>
        {isLoadingJournals ? <p className="dashboard-page__empty">در حال دریافت اسناد اخیر...</p> : null}
        {!isLoadingJournals && canViewJournals && recentVouchers.length === 0 ? (
          <div className="dashboard-page__journal-empty">
            <strong>هنوز سندی در این زمینه ثبت نشده است.</strong>
            <p>پس از ثبت سند در شرکت، شعبه و سال مالی فعال، جزئیات آن اینجا نمایش داده می‌شود.</p>
          </div>
        ) : null}
        {!canViewJournals ? <p className="dashboard-page__empty">مجوز مشاهدهٔ اسناد حسابداری برای این حساب فعال نیست.</p> : null}
        {!isLoadingJournals && recentVouchers.length > 0 ? (
          <DataTable>
            <thead><tr><th>شماره سند</th><th>شرح</th><th>تاریخ</th><th>مبلغ (ریال)</th><th>وضعیت</th></tr></thead>
            <tbody>
              {recentVouchers.map((voucher) => (
                <tr key={voucher.id}>
                  <td dir="ltr">{voucher.number}</td>
                  <td>{voucher.description || voucher.reference || "بدون شرح"}</td>
                  <td>{formatJournalVoucherDate(voucher.voucherDate)}</td>
                  <td>{formatJournalRials(voucher.totalDebit.amount)}</td>
                  <td><Badge tone={voucherTone(voucher.status)}>{voucherStatusLabels[voucher.status] ?? voucher.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : null}
      </Panel>
    </Page>
  );
}
