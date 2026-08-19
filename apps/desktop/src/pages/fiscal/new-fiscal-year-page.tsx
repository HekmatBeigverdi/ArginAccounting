import { Link } from "react-router";

import { Page, Panel } from "../../components/layout";
import { FiscalYearForm } from "../../features/fiscal/fiscal-year-form";

import "./fiscal-workspace.css";

export function NewFiscalYearPage() {
  return (
    <Page className="fiscal-workspace">
      <header className="fiscal-workspace__header">
        <div>
          <p className="fiscal-workspace__eyebrow">مدیریت مالی</p>
          <h2>ایجاد سال مالی</h2>
          <p>سال مالی و دوره اصلی آن را برای یکی از شرکت‌های ثبت‌شده تعریف کنید.</p>
        </div>
        <Link to="/fiscal/years">بازگشت به سال‌های مالی</Link>
      </header>
      <Panel className="fiscal-workspace__create-panel">
        <FiscalYearForm />
      </Panel>
    </Page>
  );
}
