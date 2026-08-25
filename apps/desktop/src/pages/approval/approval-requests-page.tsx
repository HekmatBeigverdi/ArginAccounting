import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";

import type { ApprovalRequestSummary, ApprovalStatus } from "@argin/audit";

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

const statusLabels: Record<ApprovalStatus, string> = {
  draft: "پیش‌نویس",
  pending: "در انتظار تأیید",
  approved: "تأییدشده",
  rejected: "ردشده",
  cancelled: "لغوشده",
};

function statusTone(status: ApprovalStatus) {
  if (status === "approved") return "success" as const;
  if (status === "pending") return "warning" as const;
  if (status === "rejected" || status === "cancelled") return "danger" as const;
  return "neutral" as const;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("fa-IR-u-ca-persian");
}

export function ApprovalRequestsPage() {
  const services = useAuditServices();
  const [items, setItems] = useState<ApprovalRequestSummary[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<ApprovalStatus | "">("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const result = await services.searchApprovalRequests({
        ...(text.trim() ? { text: text.trim() } : {}),
        ...(status ? { status } : {}),
        offset: 0,
        limit: 100,
      });
      setItems(result.items);
    } catch {
      setErrorMessage("دریافت درخواست‌های تأیید با خطا مواجه شد.");
    } finally {
      setIsLoading(false);
    }
  }, [services, status, text]);

  useEffect(() => { void load(); }, [load]);
  useEffect(
    () => subscribeDesktopData(desktopDataTopics.approvalRequests, () => { void load(); }),
    [load],
  );

  return (
    <Page className="governance-page">
      <header className="governance-header">
        <div>
          <p className="governance-eyebrow">کنترل داخلی / گردش تأیید</p>
          <h2>درخواست‌های تأیید</h2>
          <p>مشاهده، فیلتر و پیگیری درخواست‌های ثبت‌شده در گردش تأیید.</p>
        </div>
        <Badge tone="info" className="governance-count">{items.length.toLocaleString("fa-IR")} درخواست</Badge>
      </header>

      <Panel>
        <form className="governance-filters governance-filters--approval" onSubmit={(event) => { event.preventDefault(); void load(); }}>
          <Field label="جست‌وجو">
            <Input value={text} onChange={(event) => setText(event.target.value)} placeholder="عنوان، نوع درخواست یا سند" />
          </Field>
          <Field label="وضعیت">
            <Select value={status} onChange={(event) => setStatus(event.target.value as ApprovalStatus | "")}>
              <option value="">همه وضعیت‌ها</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Button type="submit" variant="primary" disabled={isLoading}>{isLoading ? "در حال دریافت..." : "اعمال فیلتر"}</Button>
        </form>
      </Panel>

      {errorMessage ? <Feedback tone="error">{errorMessage}</Feedback> : null}
      {isLoading ? <Feedback tone="info">در حال دریافت درخواست‌های تأیید...</Feedback> : null}
      {!isLoading && !errorMessage && items.length === 0 ? <Feedback tone="info">درخواستی مطابق فیلترها یافت نشد.</Feedback> : null}

      {!isLoading && items.length > 0 ? (
        <Panel>
          <DataTable>
            <thead><tr><th>عنوان</th><th>نوع</th><th>سند مرتبط</th><th>درخواست‌کننده</th><th>وضعیت</th><th>آخرین تغییر</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><Link className="governance-table-link" to={`/approval/requests/${item.id}`}>{item.title}</Link></td>
                  <td>{item.requestType}</td>
                  <td><span className="governance-entity-cell"><strong>{item.entityDisplayName ?? item.entityType}</strong>{item.entityDisplayName ? null : <small dir="ltr">{item.entityId}</small>}</span></td>
                  <td>{item.requestedByDisplayName ?? "سیستم"}</td>
                  <td><Badge tone={statusTone(item.status)}>{statusLabels[item.status]}</Badge></td>
                  <td>{formatDateTime(item.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>
      ) : null}
    </Page>
  );
}
