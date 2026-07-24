import {
  useEffect,
  useState
} from "react";

import type {
  AuditEntry,
  AuditSnapshot
} from "@argin/audit";

import {
  Link,
  useParams
} from "react-router";

import {
  useAuditServices
} from "../../composition/audit";

import "./audit-pages.css";

function SnapshotPanel({
  title,
  value
}: {
  title: string;
  value: AuditSnapshot | null;
}) {
  return (
    <section className="audit-card">
      <h2>{title}</h2>
      {value === null ? (
        <p className="audit-muted">اطلاعاتی ثبت نشده است.</p>
      ) : (
        <pre className="audit-snapshot" dir="ltr">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </section>
  );
}

function display(value: string | null): string {
  return value?.trim() || "—";
}

export function AuditEntryDetailsPage() {
  const { id = "" } = useParams();
  const { getAuditEntry } = useAuditServices();
  const [entry, setEntry] = useState<AuditEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function load(): Promise<void> {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const loaded = await getAuditEntry(id);
        if (isMounted) {
          setEntry(loaded);
        }
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setErrorMessage("جزئیات رویداد ممیزی دریافت نشد.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, [getAuditEntry, id]);

  if (isLoading) {
    return <p className="audit-message">در حال دریافت جزئیات رویداد...</p>;
  }

  if (errorMessage || entry === null) {
    return (
      <section className="audit-page">
        <p className="audit-message audit-message--error">
          {errorMessage || "رویداد یافت نشد."}
        </p>
        <Link to="/audit/entries">بازگشت به گزارش ممیزی</Link>
      </section>
    );
  }

  return (
    <section className="audit-page">
      <header className="audit-page__header">
        <div>
          <h1>جزئیات رویداد ممیزی</h1>
          <p>{entry.id}</p>
        </div>
        <Link to="/audit/entries">بازگشت</Link>
      </header>

      <div className="audit-details-grid">
        <section className="audit-card">
          <h2>رویداد</h2>
          <dl className="audit-definition-list">
            <div><dt>زمان</dt><dd>{new Date(entry.occurredAt).toLocaleString("fa-IR")}</dd></div>
            <div><dt>عملیات</dt><dd>{entry.action}</dd></div>
            <div><dt>نتیجه</dt><dd>{entry.outcome}</dd></div>
            <div><dt>منبع</dt><dd>{entry.source}</dd></div>
            <div><dt>پیام</dt><dd>{display(entry.message)}</dd></div>
            <div><dt>دلیل</dt><dd>{display(entry.reason)}</dd></div>
          </dl>
        </section>

        <section className="audit-card">
          <h2>عامل و محدوده</h2>
          <dl className="audit-definition-list">
            <div><dt>عامل</dt><dd>{entry.actor.displayName}</dd></div>
            <div><dt>نوع عامل</dt><dd>{entry.actor.type}</dd></div>
            <div><dt>شناسه عامل</dt><dd>{display(entry.actor.id)}</dd></div>
            <div><dt>شرکت</dt><dd>{display(entry.scope.companyId)}</dd></div>
            <div><dt>شعبه</dt><dd>{display(entry.scope.branchId)}</dd></div>
            <div><dt>سال مالی</dt><dd>{display(entry.scope.fiscalYearId)}</dd></div>
          </dl>
        </section>

        <section className="audit-card">
          <h2>موجودیت هدف</h2>
          <dl className="audit-definition-list">
            <div><dt>نوع</dt><dd>{entry.target.entityType}</dd></div>
            <div><dt>شناسه</dt><dd>{display(entry.target.entityId)}</dd></div>
            <div><dt>عنوان</dt><dd>{display(entry.target.entityDisplayName)}</dd></div>
            <div><dt>Correlation ID</dt><dd dir="ltr">{display(entry.correlationId)}</dd></div>
          </dl>
        </section>

        <section className="audit-card">
          <h2>Metadata</h2>
          {entry.metadata === null ? (
            <p className="audit-muted">اطلاعاتی ثبت نشده است.</p>
          ) : (
            <pre className="audit-snapshot" dir="ltr">
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          )}
        </section>
      </div>

      <div className="audit-snapshot-grid">
        <SnapshotPanel title="وضعیت قبل" value={entry.before} />
        <SnapshotPanel title="وضعیت بعد" value={entry.after} />
      </div>
    </section>
  );
}
