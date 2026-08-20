import { Link } from "react-router";

import { useActiveContext } from "../../app/providers/active-context-provider";
import { Badge } from "../../components/data-display";
import { Page, Panel } from "../../components/layout";
import { formatJournalVoucherDate } from "../../features/accounting/journal-voucher-presenter";
import { FiscalYearForm } from "../../features/fiscal/fiscal-year-form";

import "./fiscal-workspace.css";

export function NewFiscalYearPage() {
  const context = useActiveContext();

  return (
    <Page className="fiscal-workspace fiscal-workspace--create">
      <header className="fiscal-workspace__header">
        <div>
          <p className="fiscal-workspace__eyebrow">مدیریت مالی</p>
          <h2>ایجاد سال مالی</h2>
          <p>سال مالی جدید را با تاریخ شمسی تعریف کنید؛ ذخیره‌سازی داخلی همچنان استاندارد و میلادی باقی می‌ماند.</p>
        </div>
        <Link className="fiscal-workspace__back-link" to="/fiscal/years">بازگشت به سال‌ها و دوره‌های مالی</Link>
      </header>

      <div className="fiscal-workspace__create-layout">
        <aside className="fiscal-workspace__create-aside">
          <Panel className="fiscal-workspace__context-panel">
            <div className="fiscal-workspace__context-icon" aria-hidden="true">▦</div>
            <div>
              <span>شرکت فعال</span>
              <strong>{context.activeCompany?.legalName ?? "شرکتی انتخاب نشده"}</strong>
            </div>
            {context.activeCompany ? <Badge tone="success">فعال</Badge> : <Badge>بدون انتخاب</Badge>}
          </Panel>

          <Panel className="fiscal-workspace__guide-panel">
            <h3>راهنمای ثبت سال مالی</h3>
            <ol>
              <li>کد و عنوان سال مالی را مشخص کنید.</li>
              <li>تاریخ شروع و پایان را مستقیماً به صورت هجری شمسی انتخاب کنید.</li>
              <li>در صورت نیاز، سال جدید را به عنوان سال جاری انتخاب کنید.</li>
            </ol>
          </Panel>

          {context.activeFiscalYear ? (
            <Panel className="fiscal-workspace__previous-panel">
              <span>سال مالی فعال فعلی</span>
              <strong>{context.activeFiscalYear.title}</strong>
              <small>
                {formatJournalVoucherDate(context.activeFiscalYear.startDate)} تا {formatJournalVoucherDate(context.activeFiscalYear.endDate)}
              </small>
            </Panel>
          ) : null}
        </aside>

        <Panel className="fiscal-workspace__create-panel">
          <FiscalYearForm companyId={context.companyId || undefined} />
        </Panel>
      </div>
    </Page>
  );
}
