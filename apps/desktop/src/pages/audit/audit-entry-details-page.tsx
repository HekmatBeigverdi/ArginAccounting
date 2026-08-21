import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import type { AuditEntry, AuditSnapshot } from "@argin/audit";

import { Badge } from "../../components/data-display";
import { Feedback } from "../../components/feedback";
import { Card, Page, Panel } from "../../components/layout";
import { useAuditServices } from "../../composition/audit";

import "../governance/governance-workspace.css";

const outcomeLabels: Record<string, string> = {
  success: "موفق",
  failure: "ناموفق",
  denied: "رد دسترسی",
};

function outcomeTone(outcome: string) {
  if (outcome === "success") return "success" as const;
  if (outcome === "denied") return "warning" as const;
  if (outcome === "failure") return "danger" as const;
  return "neutral" as const;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("fa-IR-u-ca-persian");
}

function display(value: string | null): string {
  return value?.trim() || "—";
}

function SnapshotPanel({ title, value }: { title: string; value: AuditSnapshot | null }) {
  return (
    <Panel>
      <div className="governance-card-title"><div><h3>{title}</h3><p>Snapshot ثبت‌شده در رویداد ممیزی.</p></div></div>
      {value === null ? <p className="governance-muted">اطلاعاتی ثبت نشده است.</p> : <pre className="governance-snapshot" dir="ltr">{JSON.stringify(value, null, 2)}</pre>}
    </Panel>
  );
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
        if (isMounted) setEntry(loaded);
      } catch {
        if (isMounted) setErrorMessage("جزئیات رویداد ممیزی دریافت نشد.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void load();
    return () => { isMounted = false; };
  }, [getAuditEntry, id]);

  if (isLoading) {
    return <Page className="governance-page"><Feedback tone="info">در حال دریافت جزئیات رویداد...</Feedback></Page>;
  }

  if (errorMessage || entry === null) {
    return (
      <Page className="governance-page">
        <Feedback tone="error">{errorMessage || "رویداد یافت نشد."}</Feedback>
        <Link className="governance-back-link" to="/audit/entries">بازگشت به گزارش ممیزی</Link>
      </Page>
    );
  }

  return (
    <Page className="governance-page">
      <header className="governance-header">
        <div>
          <p className="governance-eyebrow">کنترل داخلی / جزئیات ممیزی</p>
          <h2>جزئیات رویداد ممیزی</h2>
          <p dir="ltr">{entry.id}</p>
        </div>
        <div className="governance-header__actions">
          <Badge tone={outcomeTone(entry.outcome)}>{outcomeLabels[entry.outcome] ?? entry.outcome}</Badge>
          <Link className="governance-back-link" to="/audit/entries">بازگشت به گزارش</Link>
        </div>
      </header>

      <div className="governance-detail-grid governance-detail-grid--three">
        <Card>
          <div className="governance-card-title"><div><h3>رویداد</h3><p>مشخصات اصلی رویداد ثبت‌شده.</p></div></div>
          <dl className="governance-definition-list">
            <div><dt>زمان</dt><dd>{formatDateTime(entry.occurredAt)}</dd></div>
            <div><dt>عملیات</dt><dd>{entry.action}</dd></div>
            <div><dt>نتیجه</dt><dd><Badge tone={outcomeTone(entry.outcome)}>{outcomeLabels[entry.outcome] ?? entry.outcome}</Badge></dd></div>
            <div><dt>منبع</dt><dd>{entry.source}</dd></div>
            <div><dt>پیام</dt><dd>{display(entry.message)}</dd></div>
            <div><dt>دلیل</dt><dd>{display(entry.reason)}</dd></div>
          </dl>
        </Card>

        <Card>
          <div className="governance-card-title"><div><h3>عامل و محدوده</h3><p>هویت عامل و محدوده سازمانی رویداد.</p></div></div>
          <dl className="governance-definition-list">
            <div><dt>عامل</dt><dd>{entry.actor.displayName}</dd></div>
            <div><dt>نوع عامل</dt><dd>{entry.actor.type}</dd></div>
            <div><dt>شناسه عامل</dt><dd dir="ltr">{display(entry.actor.id)}</dd></div>
            <div><dt>شرکت</dt><dd dir="ltr">{display(entry.scope.companyId)}</dd></div>
            <div><dt>شعبه</dt><dd dir="ltr">{display(entry.scope.branchId)}</dd></div>
            <div><dt>سال مالی</dt><dd dir="ltr">{display(entry.scope.fiscalYearId)}</dd></div>
          </dl>
        </Card>

        <Card>
          <div className="governance-card-title"><div><h3>موجودیت هدف</h3><p>موجودیتی که این رویداد به آن مربوط است.</p></div></div>
          <dl className="governance-definition-list">
            <div><dt>نوع</dt><dd>{entry.target.entityType}</dd></div>
            <div><dt>شناسه</dt><dd dir="ltr">{display(entry.target.entityId)}</dd></div>
            <div><dt>عنوان</dt><dd>{display(entry.target.entityDisplayName)}</dd></div>
            <div><dt>Correlation ID</dt><dd dir="ltr">{display(entry.correlationId)}</dd></div>
          </dl>
        </Card>
      </div>

      <Panel>
        <div className="governance-card-title"><div><h3>Metadata</h3><p>داده تکمیلی ثبت‌شده همراه رویداد.</p></div></div>
        {entry.metadata === null ? <p className="governance-muted">اطلاعاتی ثبت نشده است.</p> : <pre className="governance-snapshot" dir="ltr">{JSON.stringify(entry.metadata, null, 2)}</pre>}
      </Panel>

      <div className="governance-snapshot-grid">
        <SnapshotPanel title="وضعیت قبل" value={entry.before} />
        <SnapshotPanel title="وضعیت بعد" value={entry.after} />
      </div>
    </Page>
  );
}
