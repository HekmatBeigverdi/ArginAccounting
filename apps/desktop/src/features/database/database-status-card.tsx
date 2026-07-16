import {
  useDatabaseStatus
} from "./use-database-status";

export function DatabaseStatusCard() {
  const status = useDatabaseStatus();

  if (status.state === "loading") {
    return (
      <section className="database-card">
        <h2>پایگاه داده</h2>
        <p>در حال آماده‌سازی پایگاه داده محلی...</p>
      </section>
    );
  }

  if (status.state === "error") {
    return (
      <section className="database-card database-card-error">
        <h2>خطای پایگاه داده</h2>
        <p>{status.message}</p>
      </section>
    );
  }

  return (
    <section className="database-card">
      <h2>پایگاه داده آفلاین</h2>

      <dl>
        <div>
          <dt>وضعیت</dt>
          <dd>آماده</dd>
        </div>

        <div>
          <dt>موتور</dt>
          <dd>SQLite</dd>
        </div>

        <div>
          <dt>نسخه</dt>
          <dd>{status.health.databaseVersion}</dd>
        </div>

        <div>
          <dt>کلیدهای خارجی</dt>
          <dd>
            {status.health.foreignKeysEnabled
              ? "فعال"
              : "غیرفعال"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
