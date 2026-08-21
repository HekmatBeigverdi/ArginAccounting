import { Link } from "react-router";

import { useActiveContext } from "../../app/providers/active-context-provider";
import { Badge } from "../../components/data-display";
import { Page, Panel } from "../../components/layout";
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
          <p>اطلاعات سال مالی را یک‌جا و با تاریخ هجری شمسی وارد کنید.</p>
        </div>
        <Link className="fiscal-workspace__back-link" to="/fiscal/years">
          بازگشت به سال‌ها و دوره‌های مالی
        </Link>
      </header>

      <div className="fiscal-workspace__create-shell">
        <div className="fiscal-workspace__context-strip">
          <div>
            <span>شرکت فعال</span>
            <strong>{context.activeCompany?.legalName ?? "شرکتی انتخاب نشده"}</strong>
          </div>
          {context.activeCompany ? <Badge tone="success">فعال</Badge> : <Badge>بدون انتخاب</Badge>}
        </div>

        <Panel className="fiscal-workspace__create-panel">
          <FiscalYearForm companyId={context.companyId || undefined} />
        </Panel>
      </div>
    </Page>
  );
}
