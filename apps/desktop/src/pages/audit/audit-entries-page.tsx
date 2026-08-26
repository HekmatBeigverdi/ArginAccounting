import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router";

import type { AuditAction, AuditEntrySummary, AuditOutcome } from "@argin/audit";

import {
  desktopDataTopics,
  subscribeDesktopData,
} from "../../app/data-invalidation";
import { Badge, DataTable } from "../../components/data-display";
import { Feedback } from "../../components/feedback";
import { Button, Field, Input, Select } from "../../components/forms";
import { Page, Panel } from "../../components/layout";
import { useAuditServices } from "../../composition/audit";

import "../governance/governance-workspace.css";

const actionLabels: Record<string, string> = {
  create: "ایجاد",
  update: "ویرایش",
  delete: "حذف",
  restore: "بازیابی",
  submit: "ارسال",
  approve: "تأیید",
  reject: "رد",
  cancel: "لغو",
  login: "ورود",
  logout: "خروج",
  "login-failed": "ورود ناموفق",
  "password-change": "تغییر رمز",
  "status-change": "تغییر وضعیت",
  assign: "انتساب",
  unassign: "لغو انتساب",
  export: "خروجی",
  import: "ورودی",
  print: "چاپ",
  view: "مشاهده",
};

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

export function AuditEntriesPage() {
  const { searchAuditEntries } = useAuditServices();
  const [items, setItems] = useState<AuditEntrySummary[]>([]);
  const [text, setText] = useState("");
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("");
  const [entityType, setEntityType] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const result = await searchAuditEntries({
        ...(text.trim() ? { text: text.trim() } : {}),
        ...(action ? { action: action as AuditAction } : {}),
        ...(outcome ? { outcome: outcome as AuditOutcome } : {}),
        ...(entityType.trim() ? { entityType: entityType.trim() } : {}),
        offset: 0,
        limit: 100,
      });
      setItems(result.items);
      setTotalCount(result.totalCount);
    } catch {
      setErrorMessage("دریافت گزارش ممیزی با خطا مواجه شد.");
    } finally {
      setIsLoading(false);
    }
  }, [action, entityType, outcome, searchAuditEntries, text]);

  useEffect(() => { void load(); }, [load]);
  useEffect(
    () => subscribeDesktopData(desktopDataTopics.auditEntries, () => { void load(); }),
    [load],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void load();
  }

  return (
    <Page className="governance-page">
      <header className="governance-header">
        <div>
          <p className="governance-eyebrow">کنترل داخلی / ممیزی</p>
          <h2>گزارش ممیزی</h2>
          <p>ردیابی رویدادهای ثبت‌شده توسط کاربران، سیستم و یکپارچه‌سازی‌ها.</p>
        </div>
        <Badge tone="info" className="governance-count">{totalCount.toLocaleString("fa-IR")} رویداد</Badge>
      </header>

      <Panel>
        <form className="governance-filters" onSubmit={handleSubmit}>
          <Field label="جست‌وجو">
            <Input value={text} placeholder="پیام، دلیل یا شناسه" onChange={(event) => setText(event.target.value)} />
          </Field>
          <Field label="عملیات">
            <Select value={action} onChange={(event) => setAction(event.target.value)}>
              <option value="">همه عملیات‌ها</option>
              {Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="نتیجه">
            <Select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
              <option value="">همه نتایج</option>
              {Object.entries(outcomeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="نوع موجودیت">
            <Input value={entityType} placeholder="مثلاً Company" onChange={(event) => setEntityType(event.target.value)} />
          </Field>
          <Button type="submit" variant="primary" disabled={isLoading}>{isLoading ? "در حال دریافت..." : "اعمال فیلتر"}</Button>
        </form>
      </Panel>

      {errorMessage ? <Feedback tone="error">{errorMessage}</Feedback> : null}
      {isLoading ? <Feedback tone="info">در حال دریافت رویدادهای ممیزی...</Feedback> : null}
      {!isLoading && !errorMessage && items.length === 0 ? <Feedback tone="info">رویدادی مطابق فیلترها یافت نشد.</Feedback> : null}

      {!isLoading && items.length > 0 ? (
        <Panel>
          <DataTable>
            <thead><tr><th>زمان</th><th>عملیات</th><th>نتیجه</th><th>عامل</th><th>موجودیت</th><th>منبع</th><th>جزئیات</th></tr></thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.occurredAt)}</td>
                  <td>{actionLabels[entry.action] ?? entry.action}</td>
                  <td><Badge tone={outcomeTone(entry.outcome)}>{outcomeLabels[entry.outcome] ?? entry.outcome}</Badge></td>
                  <td>{entry.actor.displayName}</td>
                  <td><span className="governance-entity-cell"><strong>{entry.target.entityDisplayName ?? entry.target.entityType}</strong>{entry.target.entityId ? <small dir="ltr">{entry.target.entityId}</small> : null}</span></td>
                  <td>{entry.source}</td>
                  <td><Link className="governance-table-link" to={`/audit/entries/${entry.id}`}>مشاهده</Link></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>
      ) : null}
    </Page>
  );
}
