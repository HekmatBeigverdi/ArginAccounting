import { useEffect, useState } from "react";

import type { FiscalPeriod } from "@argin/fiscal";
import { SqliteFiscalPeriodRepository } from "@argin/fiscal-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

import { useActiveContext } from "../../app/providers/active-context-provider";
import { Badge } from "../../components/data-display";
import { Feedback } from "../../components/feedback";
import { Button } from "../../components/forms";
import { Card, Page, Panel } from "../../components/layout";
import { formatJournalVoucherDate } from "../../features/accounting/journal-voucher-presenter";
import { FiscalYearForm } from "../../features/fiscal/fiscal-year-form";

import "./fiscal-workspace.css";

const yearStatusLabels = {
  draft: "پیش‌نویس",
  open: "باز",
  closing: "در حال بستن",
  closed: "بسته"
} as const;

const periodStatusLabels = {
  open: "باز",
  locked: "قفل‌شده",
  closed: "بسته"
} as const;

function yearTone(status: keyof typeof yearStatusLabels) {
  if (status === "open") return "success" as const;
  if (status === "closing") return "warning" as const;
  if (status === "draft") return "info" as const;
  return "neutral" as const;
}

function periodTone(status: keyof typeof periodStatusLabels) {
  if (status === "open") return "success" as const;
  if (status === "locked") return "warning" as const;
  return "neutral" as const;
}

export function FiscalYearsPage() {
  const context = useActiveContext();
  const [periods, setPeriods] = useState<readonly FiscalPeriod[]>([]);
  const [periodError, setPeriodError] = useState("");
  const [isLoadingPeriods, setIsLoadingPeriods] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!context.fiscalYearId) {
      setPeriods([]);
      setPeriodError("");
      return;
    }

    setIsLoadingPeriods(true);
    setPeriodError("");
    void getDesktopDatabase()
      .then((database) =>
        new SqliteFiscalPeriodRepository(database).findByFiscalYearId(context.fiscalYearId)
      )
      .then((records) => {
        if (!cancelled) setPeriods(records);
      })
      .catch(() => {
        if (!cancelled) setPeriodError("دریافت دوره‌های سال مالی با خطا مواجه شد.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPeriods(false);
      });

    return () => { cancelled = true; };
  }, [context.fiscalYearId]);

  async function handleCreated(fiscalYearId: string): Promise<void> {
    await context.refresh();
    context.setFiscalYearId(fiscalYearId);
    setShowCreate(false);
  }

  if (context.isLoading) {
    return <Page className="fiscal-workspace"><Panel>در حال دریافت اطلاعات سال‌های مالی...</Panel></Page>;
  }

  return (
    <Page className="fiscal-workspace">
      <header className="fiscal-workspace__header">
        <div>
          <p className="fiscal-workspace__eyebrow">مدیریت مالی</p>
          <h2>سال‌ها و دوره‌های مالی</h2>
          <p>سال مالی شرکت فعال را انتخاب کنید، وضعیت و دوره‌های آن را ببینید یا سال مالی جدید تعریف کنید.</p>
        </div>
        <Button
          type="button"
          variant={showCreate ? "default" : "primary"}
          onClick={() => setShowCreate((value) => !value)}
          disabled={!context.activeCompany}
        >
          {showCreate ? "بازگشت به فضای کاری" : "سال مالی جدید"}
        </Button>
      </header>

      {context.error ? <Feedback tone="error">{context.error}</Feedback> : null}

      {!context.activeCompany ? (
        <Feedback tone="info">برای مدیریت سال‌های مالی ابتدا یک شرکت تعریف یا از نوار بالای برنامه انتخاب کنید.</Feedback>
      ) : null}

      {context.activeCompany && showCreate ? (
        <Panel className="fiscal-workspace__create-panel">
          <FiscalYearForm companyId={context.activeCompany.id} onCreated={handleCreated} />
        </Panel>
      ) : null}

      {context.activeCompany && !showCreate ? (
        <div className="fiscal-workspace__layout">
          <aside className="fiscal-workspace__years" aria-label="سال‌های مالی">
            <div className="fiscal-workspace__section-heading">
              <div>
                <h3>سال‌های مالی {context.activeCompany.legalName}</h3>
                <p>{context.fiscalYears.length} سال مالی ثبت‌شده</p>
              </div>
            </div>

            {context.fiscalYears.length === 0 ? (
              <Panel className="fiscal-workspace__empty">
                <strong>هنوز سال مالی ثبت نشده است.</strong>
                <p>برای شروع عملیات مالی، اولین سال مالی این شرکت را تعریف کنید.</p>
                <Button type="button" variant="primary" onClick={() => setShowCreate(true)}>تعریف سال مالی</Button>
              </Panel>
            ) : (
              <div className="fiscal-workspace__year-list">
                {context.fiscalYears.map((year) => (
                  <button
                    key={year.id}
                    type="button"
                    className={`fiscal-workspace__year ${year.id === context.fiscalYearId ? "fiscal-workspace__year--active" : ""}`}
                    onClick={() => context.setFiscalYearId(year.id)}
                  >
                    <span>
                      <strong>{year.title}</strong>
                      <small dir="ltr">{year.code}</small>
                    </span>
                    <span className="fiscal-workspace__year-badges">
                      {year.isCurrent ? <Badge tone="info">جاری</Badge> : null}
                      <Badge tone={yearTone(year.status)}>{yearStatusLabels[year.status]}</Badge>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <main className="fiscal-workspace__details">
            {context.activeFiscalYear ? (
              <>
                <Card className="fiscal-workspace__summary">
                  <div className="fiscal-workspace__summary-title">
                    <div>
                      <p>سال مالی انتخاب‌شده</p>
                      <h3>{context.activeFiscalYear.title}</h3>
                    </div>
                    <div className="fiscal-workspace__year-badges">
                      {context.activeFiscalYear.isCurrent ? <Badge tone="info">سال جاری</Badge> : null}
                      <Badge tone={yearTone(context.activeFiscalYear.status)}>
                        {yearStatusLabels[context.activeFiscalYear.status]}
                      </Badge>
                    </div>
                  </div>
                  <dl className="fiscal-workspace__facts">
                    <div><dt>کد</dt><dd dir="ltr">{context.activeFiscalYear.code}</dd></div>
                    <div><dt>شروع</dt><dd>{formatJournalVoucherDate(context.activeFiscalYear.startDate)}</dd></div>
                    <div><dt>پایان</dt><dd>{formatJournalVoucherDate(context.activeFiscalYear.endDate)}</dd></div>
                    <div><dt>تعداد دوره‌ها</dt><dd>{periods.length}</dd></div>
                  </dl>
                </Card>

                <Panel className="fiscal-workspace__periods">
                  <div className="fiscal-workspace__section-heading">
                    <div>
                      <h3>دوره‌های مالی</h3>
                      <p>وضعیت دوره‌های ثبت‌شده برای سال مالی انتخاب‌شده.</p>
                    </div>
                  </div>

                  {periodError ? <Feedback tone="error">{periodError}</Feedback> : null}
                  {isLoadingPeriods ? <p className="fiscal-workspace__muted">در حال دریافت دوره‌ها...</p> : null}
                  {!isLoadingPeriods && !periodError && periods.length === 0 ? (
                    <Feedback tone="info">برای این سال مالی دوره‌ای ثبت نشده است.</Feedback>
                  ) : null}
                  {periods.length > 0 ? (
                    <div className="fiscal-workspace__period-list">
                      {periods.map((period) => (
                        <div key={period.id} className="fiscal-workspace__period">
                          <div>
                            <strong>{period.title}</strong>
                            <span dir="ltr">{period.code}</span>
                          </div>
                          <div className="fiscal-workspace__period-range">
                            {formatJournalVoucherDate(period.startDate)} تا {formatJournalVoucherDate(period.endDate)}
                          </div>
                          <Badge tone={periodTone(period.status)}>{periodStatusLabels[period.status]}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Panel>
              </>
            ) : context.fiscalYears.length > 0 ? (
              <Feedback tone="info">یک سال مالی را برای مشاهده جزئیات انتخاب کنید.</Feedback>
            ) : null}
          </main>
        </div>
      ) : null}
    </Page>
  );
}
