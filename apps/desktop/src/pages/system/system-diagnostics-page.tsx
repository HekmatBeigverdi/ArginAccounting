import {
  DatabaseStatusCard
} from "../../features/database/database-status-card";

export function SystemDiagnosticsPage() {
  return (
    <section className="temporary-page">
      <header className="temporary-page__header">
        <div>
          <p className="temporary-page__eyebrow">
            سیستم
          </p>

          <h1>وضعیت سیستم</h1>

          <p>
            وضعیت دیتابیس محلی و زیرساخت اجرای برنامه
            را بررسی کنید.
          </p>
        </div>
      </header>

      <DatabaseStatusCard />
    </section>
  );
}
