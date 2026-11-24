import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import type { JournalVoucherListItemDto } from "@argin/accounting/journal";

import { useActiveContext } from "../../app/providers/active-context-provider";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { Badge } from "../../components/data-display";
import { Feedback } from "../../components/feedback";
import { Card, Page, Panel } from "../../components/layout";
import { useAccountingServices } from "../../composition/accounting/accounting-provider";
import {
  formatJournalRials,
  journalVoucherStatusLabel,
} from "../../features/accounting/journal-voucher-presenter";

import referenceMetricCardIcon from "../../app/shell/assets/reference/metric-card.svg";
import referenceMetricFilterIcon from "../../app/shell/assets/reference/metric-filter.svg";
import referenceMetricLayersIcon from "../../app/shell/assets/reference/metric-layers.svg";
import referenceMetricTrendIcon from "../../app/shell/assets/reference/metric-trend.svg";
import referencePurchaseSeries from "../../app/shell/assets/reference/chart-purchase-series.svg";
import referenceSalesSeries from "../../app/shell/assets/reference/chart-sales-series.svg";
import referenceQuickArrow from "../../app/shell/assets/reference/quick-arrow.svg";
import referenceQuickJournalIcon from "../../app/shell/assets/reference/quick-journal.svg";
import referenceQuickPurchaseIcon from "../../app/shell/assets/reference/quick-purchase.svg";
import referenceQuickReportIcon from "../../app/shell/assets/reference/quick-report.svg";
import referenceQuickSalesIcon from "../../app/shell/assets/reference/quick-sales.svg";
import "./dashboard-page.css";

type DashboardMetric = {
  key: string;
  label: string;
  value: string;
  note: string;
  icon: string;
  tone: "mint" | "blue" | "amber" | "teal";
};

type DashboardTrendPoint = {
  month: string;
  sales: number;
  purchases: number;
};

// Preview values from the Figma frame. Replace this presentation model with
// dashboard aggregate contracts when those become available.
const dashboardPreviewMetrics: readonly DashboardMetric[] = [
  {
    key: "net-sales",
    label: "فروش خالص",
    value: "۱٬۴۸۰٬۰۰۰٬۰۰۰",
    note: "↑ ۱۲٫۴٪ نسبت به ماه قبل",
    icon: referenceMetricCardIcon,
    tone: "mint",
  },
  {
    key: "receipts",
    label: "دریافت‌ها",
    value: "۳۸۰٬۰۰۰٬۰۰۰",
    note: "۲۴ فاکتور باز",
    icon: referenceMetricTrendIcon,
    tone: "blue",
  },
  {
    key: "due-payments",
    label: "پرداخت‌های سررسید",
    value: "۲۱۰٬۰۰۰٬۰۰۰",
    note: "۸ سررسید نزدیک",
    icon: referenceMetricFilterIcon,
    tone: "amber",
  },
  {
    key: "inventory-value",
    label: "ارزش موجودی",
    value: "۹۲۰٬۰۰۰٬۰۰۰",
    note: "بر اساس ارزش‌گذاری",
    icon: referenceMetricLayersIcon,
    tone: "teal",
  },
];

// Bar heights mirror the seven illustrative month pairs in the Figma design.
const dashboardPreviewTrend: readonly DashboardTrendPoint[] = [
  { month: "فروردین", sales: 51, purchases: 38 },
  { month: "اردیبهشت", sales: 73, purchases: 54 },
  { month: "خرداد", sales: 87, purchases: 64 },
  { month: "تیر", sales: 111, purchases: 78 },
  { month: "مرداد", sales: 102, purchases: 72 },
  { month: "شهریور", sales: 115, purchases: 96 },
  { month: "مهر", sales: 115, purchases: 115 },
];

const reportPermissions = [
  "accounting.reports.trial-balance.view",
  "accounting.reports.general-ledger.view",
  "accounting.reports.subsidiary-ledger.view",
  "accounting.reports.journal.view",
  "accounting.reports.dimensions.view",
] as const;

function journalStatusTone(status: JournalVoucherListItemDto["status"]) {
  switch (status) {
    case "posted": return "success" as const;
    case "pending_approval": return "warning" as const;
    case "reversed": return "danger" as const;
    case "approved": return "info" as const;
    case "draft": return "neutral" as const;
  }
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

  useEffect(() => {
    let cancelled = false;

    if (!context.companyId || !canViewJournals) {
      setRecentVouchers([]);
      setJournalError("");
      setIsLoadingJournals(false);
      return;
    }

    setIsLoadingJournals(true);
    setJournalError("");
    const query = {
      companyId: context.companyId,
      ...(context.branchId ? { branchId: context.branchId } : {}),
      page: 1,
      pageSize: 3,
    };
    const request = context.fiscalYearId
      ? journals.list({ ...query, fiscalYearId: context.fiscalYearId })
        .then((page) => page.items.length > 0 ? page : journals.list(query))
      : journals.list(query);

    void request
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

    return () => {
      cancelled = true;
    };
  }, [
    canViewJournals,
    context.branchId,
    context.companyId,
    context.fiscalYearId,
    journals,
  ]);

  const quickActions = [
    ...(canViewJournals ? [{
      label: "ثبت سند حسابداری",
      path: "/accounting/journal-vouchers",
      icon: referenceQuickJournalIcon,
      tone: "mint",
    }] : []),
    ...(hasFullAccess || permissions.has("sales.documents.view") ? [{
      label: "صدور فاکتور فروش",
      path: "/sales/documents",
      icon: referenceQuickSalesIcon,
      tone: "blue",
    }] : []),
    ...(hasFullAccess || permissions.has("purchases.documents.view") ? [{
      label: "ثبت فاکتور خرید",
      path: "/purchases/documents",
      icon: referenceQuickPurchaseIcon,
      tone: "mint",
    }] : []),
    ...(hasFullAccess || reportPermissions.some((permission) => permissions.has(permission)) ? [{
      label: "گزارش دفتر کل",
      path: "/accounting/reports",
      icon: referenceQuickReportIcon,
      tone: "blue",
    }] : []),
  ];

  if (context.isLoading) {
    return (
      <Page className="dashboard-page" aria-busy="true">
        <Panel className="dashboard-page__loading">
          در حال آماده‌سازی داشبورد و زمینه کاری...
        </Panel>
      </Page>
    );
  }

  return (
    <Page className="dashboard-page">
      <section className="dashboard-page__heading" aria-labelledby="dashboard-title">
        <div>
          <h2 id="dashboard-title">نمای کلی شرکت</h2>
          <p>مروری روشن بر جریان مالی، عملکرد و فعالیت‌های مهم</p>
        </div>
        {canViewJournals ? (
          <Link className="dashboard-page__new-document" to="/accounting/journal-vouchers">
            <span aria-hidden="true">＋</span>
            سند جدید
          </Link>
        ) : null}
      </section>

      {context.error ? <Feedback tone="error">{context.error}</Feedback> : null}
      {!context.activeCompany ? (
        <Feedback tone="info">
          هنوز شرکتی ثبت نشده است. برای شروع، اطلاعات شرکت و دفتر مرکزی را تعریف کنید.
          {" "}<Link to="/company/setup">تعریف شرکت</Link>
        </Feedback>
      ) : null}

      <section className="dashboard-page__metrics" aria-label="شاخص‌های مالی نمایشی">
        {dashboardPreviewMetrics.map((metric) => (
          <Card key={metric.key} className={`dashboard-page__metric dashboard-page__metric--${metric.tone}`}>
            <div className="dashboard-page__metric-icon" aria-hidden="true">
              <img src={metric.icon} alt="" />
            </div>
            <p>{metric.label}</p>
            <strong dir="ltr">{metric.value}</strong>
            <span>{metric.note}</span>
          </Card>
        ))}
      </section>

      <div className="dashboard-page__middle-row">
        <Card className="dashboard-page__trend-panel">
          <div className="dashboard-page__panel-heading">
            <div>
              <h3>روند فروش و خرید</h3>
              <p>عملکرد ماهانهٔ دریافتی‌ها</p>
            </div>
            <div className="dashboard-page__legend" aria-hidden="true">
              <span>فروش<img src={referenceSalesSeries} alt="" /></span>
              <span>خرید<img src={referencePurchaseSeries} alt="" /></span>
            </div>
          </div>
          <div className="dashboard-page__chart" role="img" aria-label="نمودار نمایشی فروش و خرید از فروردین تا مهر">
            {dashboardPreviewTrend.map((point) => (
              <div className="dashboard-page__chart-month" key={point.month}>
                <div className="dashboard-page__chart-bars">
                  <span className="dashboard-page__bar dashboard-page__bar--sales" style={{ height: `${point.sales}px` }} />
                  <span className="dashboard-page__bar dashboard-page__bar--purchases" style={{ height: `${point.purchases}px` }} />
                </div>
                <span className="dashboard-page__chart-label">{point.month}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="dashboard-page__quick-panel">
          <div className="dashboard-page__panel-heading">
            <div>
              <h3>دسترسی سریع</h3>
              <p>کارهای پرکاربرد روزانه</p>
            </div>
          </div>
          {quickActions.length ? (
            <nav className="dashboard-page__quick-actions" aria-label="دسترسی سریع داشبورد">
              {quickActions.map((action) => (
                <Link className={`dashboard-page__quick-action dashboard-page__quick-action--${action.tone}`} key={action.path} to={action.path}>
                  <span className="dashboard-page__quick-icon" aria-hidden="true"><img src={action.icon} alt="" /></span>
                  <span>{action.label}</span>
                  <span className="dashboard-page__quick-arrow" aria-hidden="true"><img src={referenceQuickArrow} alt="" /></span>
                </Link>
              ))}
            </nav>
          ) : (
            <p className="dashboard-page__no-actions">برای نمایش دسترسی‌ها، مجوزهای مرتبط لازم است.</p>
          )}
        </Card>
      </div>

      {canViewJournals ? (
        <Card className="dashboard-page__activity-panel">
          <div className="dashboard-page__activity-heading">
            <h3 id="recent-journals-title">آخرین اسناد حسابداری</h3>
            <Link to="/accounting/journal-vouchers">مشاهدهٔ همه</Link>
          </div>
          {isLoadingJournals ? <p className="dashboard-page__loading" role="status">در حال دریافت اسناد اخیر...</p> : null}
          {journalError ? <Feedback tone="warning">{journalError}</Feedback> : null}
          {!isLoadingJournals && !journalError && !context.activeFiscalYear && recentVouchers.length === 0 ? (
            <div className="dashboard-page__journal-empty">
              <strong>سال مالی فعالی برای نمایش اسناد وجود ندارد.</strong>
              <p>پس از تعریف یا انتخاب سال مالی، اسناد همان زمینه در این بخش نمایش داده می‌شوند.</p>
              <Link to="/fiscal/years">مدیریت سال‌های مالی</Link>
            </div>
          ) : null}
          {!isLoadingJournals && !journalError && context.activeFiscalYear && recentVouchers.length === 0 ? (
            <div className="dashboard-page__journal-empty">
              <strong>هنوز سندی در این زمینه ثبت نشده است.</strong>
              <p>می‌توانید اولین سند حسابداری پیش‌نویس را از فضای اسناد ایجاد کنید.</p>
              <Link to="/accounting/journal-vouchers">رفتن به اسناد حسابداری</Link>
            </div>
          ) : null}
          {recentVouchers.length > 0 ? (
            <div className="dashboard-page__table-scroll">
              <table className="dashboard-page__table">
                <thead>
                  <tr>
                    <th scope="col">شماره سند</th>
                    <th scope="col">شرح</th>
                    <th scope="col">مبلغ (ریال)</th>
                    <th scope="col">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {recentVouchers.map((voucher) => (
                    <tr key={voucher.id}>
                      <td dir="ltr">{voucher.number}</td>
                      <td>{voucher.description || voucher.reference || "بدون شرح"}</td>
                      <td dir="ltr">{formatJournalRials(voucher.totalDebit.amount)}</td>
                      <td><Badge tone={journalStatusTone(voucher.status)}>{journalVoucherStatusLabel(voucher.status)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      ) : null}
    </Page>
  );
}
