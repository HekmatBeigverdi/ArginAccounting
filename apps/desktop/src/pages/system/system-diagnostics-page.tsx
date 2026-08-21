import { Page } from "../../components/layout";
import { DatabaseStatusCard } from "../../features/database/database-status-card";

import "./system-diagnostics-page.css";

export function SystemDiagnosticsPage() {
  return (
    <Page className="system-diagnostics">
      <header className="system-diagnostics__header">
        <div>
          <p className="system-diagnostics__eyebrow">مدیریت سیستم / زیرساخت</p>
          <h1>وضعیت سیستم</h1>
          <p>وضعیت دیتابیس محلی و زیرساخت اجرای برنامه را بررسی کنید.</p>
        </div>
      </header>
      <DatabaseStatusCard />
    </Page>
  );
}
