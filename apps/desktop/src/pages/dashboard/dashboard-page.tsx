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
  formatJournalVoucherDate,
} from "../../features/accounting/journal-voucher-presenter";

import "./dashboard-page.css";

const fiscalStatusLabels = {
  draft: "پیش‌نویس",
  open: "باز",
  closing: "در حال بستن",
  closed: "بسته",
} as const;

function fiscalStatusTone(status: keyof typeof fiscalStatusLabels) {
  switch (status) {
    case "open": return "success" as const;
    case "closing": return "warning" as const;
    case "closed": return "neutral" as const;
    case "draft": return "info" as const;
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
  const canViewJournals =
    permissions.has("system.full-access") ||
    permissions.has("accounting.journal-vouchers.view");

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

  const shortcuts = useMemo(() => [
    ...(canViewJournals ? [{
      label: "عملیات روزانه",
      title: "اسناد حسابداری",
      description: "ثبت، جستجو و ویرایش اسناد حسابداری پیش‌نویس.",
      path: "/accounting/journal-vouchers",
    }] : []),
    {
      label: "ساختار حسابداری",
      title: "کدینگ حساب‌ها",
      description: "مشاهده و مدیریت ساختار درختی حساب‌های شرکت فعال.",
      path: "/accounting/chart-of-accounts",
    },
    {
      label: "اطلاعات پایه",
      title: "شرکت و شعب",
      description: "تعریف اطلاعات شرکت و دفتر مرکزی در فضای کاری فعلی.",
      path: "/company/setup",
    },
    {
      label: "مدیریت مالی",
      title: "سال‌های مالی",
      description: "تعریف و مشاهده سال مالی مورد استفاده عملیات حسابداری.",
      path: "/fiscal/years",
    },
    {
      label: "ساختار حسابداری",
      title: "ابعاد حسابداری",
      description: "مدیریت انواع ابعاد، اعضا و سیاست‌های تخصیص.",
      path: "/accounting/dimensions",
    },
    {
      label: "کنترل سیستم",
      title: "وضعیت سیستم",
      description: "بررسی وضعیت پایگاه داده و زیرساخت دسکتاپ.",
      path: "/system/diagnostics",
    },
  ], [canViewJournals]);

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
      <section className="dashboard-page__hero" aria-labelledby="dashboard-title">
        <div>
          <p className="dashboard-page__eyebrow">نمای کلی فضای کاری</p>
          <h2 id="dashboard-title">خوش آمدید{session?.user.displayName ? `، ${session.user.displayName}` : ""}</h2>
          <p>
            دسترسی سریع به عملیات موجود و خلاصه زمینه فعال شرکت، شعبه و سال مالی.
          </p>
        </div>
        <div className="dashboard-page__hero-status">
          <Badge tone="success">آفلاین</Badge>
          <Badge>SQLite</Badge>
        </div>
      </section>

      {context.error ? <Feedback tone="error">{context.error}</Feedback> : null}

      {!context.activeCompany ? (
        <Feedback tone="info">
          هنوز شرکتی ثبت نشده است. برای شروع، اطلاعات شرکت و دفتر مرکزی را تعریف کنید.
          {" "}<Link to="/company/setup">تعریف شرکت</Link>
        </Feedback>
      ) : null}

      <section className="dashboard-page__section" aria-labelledby="active-context-title">
        <div className="dashboard-page__section-heading">
          <div>
            <h2 id="active-context-title">زمینه کاری فعال</h2>
            <p>خلاصه انتخاب‌هایی که عملیات جاری برنامه بر اساس آن‌ها انجام می‌شود.</p>
          </div>
        </div>

        <div className="dashboard-page__context-grid">
          <Card className="dashboard-page__context-card">
            <div className="dashboard-page__context-card-header">
              <strong>شرکت</strong>
              <Badge tone={context.activeCompany?.status === "active" ? "success" : "neutral"}>
                {context.activeCompany?.status === "active" ? "فعال" : "بدون انتخاب"}
              </Badge>
            </div>
            {context.activeCompany ? (
              <dl>
                <div><dt>نام</dt><dd>{context.activeCompany.legalName}</dd></div>
                <div><dt>کد</dt><dd dir="ltr">{context.activeCompany.code}</dd></div>
                <div><dt>ارز پایه</dt><dd>ریال ایران</dd></div>
              </dl>
            ) : <p>برای نمایش اطلاعات، ابتدا یک شرکت تعریف کنید.</p>}
          </Card>

          <Card className="dashboard-page__context-card">
            <div className="dashboard-page__context-card-header">
              <strong>شعبه</strong>
              {context.activeBranch?.isHeadOffice ? <Badge tone="info">دفتر مرکزی</Badge> : <Badge>شعبه</Badge>}
            </div>
            {context.activeBranch ? (
              <dl>
                <div><dt>نام</dt><dd>{context.activeBranch.name}</dd></div>
                <div><dt>کد</dt><dd dir="ltr">{context.activeBranch.code}</dd></div>
                <div><dt>وضعیت</dt><dd>{context.activeBranch.status === "active" ? "فعال" : "غیرفعال"}</dd></div>
              </dl>
            ) : <p>برای شرکت فعال شعبه‌ای در دسترس نیست.</p>}
          </Card>

          <Card className="dashboard-page__context-card">
            <div className="dashboard-page__context-card-header">
              <strong>سال مالی</strong>
              {context.activeFiscalYear ? (
                <Badge tone={fiscalStatusTone(context.activeFiscalYear.status)}>
                  {fiscalStatusLabels[context.activeFiscalYear.status]}
                </Badge>
              ) : <Badge>بدون انتخاب</Badge>}
            </div>
            {context.activeFiscalYear ? (
              <dl>
                <div><dt>عنوان</dt><dd>{context.activeFiscalYear.title}</dd></div>
                <div><dt>کد</dt><dd dir="ltr">{context.activeFiscalYear.code}</dd></div>
                <div><dt>بازه</dt><dd>{formatJournalVoucherDate(context.activeFiscalYear.startDate)} تا {formatJournalVoucherDate(context.activeFiscalYear.endDate)}</dd></div>
              </dl>
            ) : <p>برای شرکت فعال هنوز سال مالی قابل استفاده‌ای انتخاب نشده است.</p>}
          </Card>
        </div>
      </section>

      <section className="dashboard-page__section" aria-labelledby="shortcut-title">
        <div className="dashboard-page__section-heading">
          <div>
            <h2 id="shortcut-title">دسترسی سریع</h2>
            <p>ورود مستقیم به قابلیت‌هایی که هم‌اکنون در برنامه پیاده‌سازی شده‌اند.</p>
          </div>
        </div>
        <div className="dashboard-page__shortcut-grid">
          {shortcuts.map((shortcut) => (
            <Link key={shortcut.path} to={shortcut.path} className="ui-card dashboard-page__shortcut">
              <span>{shortcut.label}</span>
              <strong>{shortcut.title}</strong>
              <p>{shortcut.description}</p>
              <div className="dashboard-page__shortcut-action">ورود به بخش ←</div>
            </Link>
          ))}
        </div>
      </section>

      {canViewJournals ? (
        <section className="dashboard-page__section" aria-labelledby="recent-journals-title">
          <div className="dashboard-page__section-heading">
            <div>
              <h2 id="recent-journals-title">اسناد حسابداری اخیر</h2>
              <p>آخرین اسناد پیش‌نویس موجود در شرکت، شعبه و سال مالی فعال.</p>
            </div>
            <Link to="/accounting/journal-vouchers">مشاهده همه اسناد</Link>
          </div>

          <Panel className="dashboard-page__journal-panel">
            {isLoadingJournals ? <p className="dashboard-page__loading">در حال دریافت اسناد اخیر...</p> : null}
            {journalError ? <Feedback tone="warning">{journalError}</Feedback> : null}
            {!isLoadingJournals && !journalError && !context.activeFiscalYear ? (
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
              <div className="dashboard-page__journal-list">
                {recentVouchers.map((voucher) => (
                  <div key={voucher.id} className="dashboard-page__journal-item">
                    <span className="dashboard-page__journal-number" dir="ltr">{voucher.number}</span>
                    <span className="dashboard-page__journal-date">{formatJournalVoucherDate(voucher.voucherDate)}</span>
                    <span className="dashboard-page__journal-description">{voucher.description || voucher.reference || "بدون شرح"}</span>
                    <span className="dashboard-page__journal-amount">{formatJournalRials(voucher.totalDebit.amount)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </Panel>
        </section>
      ) : null}
    </Page>
  );
}
