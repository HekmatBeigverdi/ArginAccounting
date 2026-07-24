import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { ApprovalRequestSummary, ApprovalStatus } from "@argin/audit";
import { useAuditServices } from "../../composition/audit";
import "./approval-pages.css";

const statusLabels: Record<ApprovalStatus, string> = {
  draft: "پیش‌نویس",
  pending: "در انتظار تأیید",
  approved: "تأییدشده",
  rejected: "ردشده",
  cancelled: "لغوشده"
};

export function ApprovalRequestsPage() {
  const services = useAuditServices();
  const navigate = useNavigate();
  const [items, setItems] = useState<ApprovalRequestSummary[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<ApprovalStatus | "">("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function load(): Promise<void> {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const result = await services.searchApprovalRequests({
        ...(text.trim() ? { text: text.trim() } : {}),
        ...(status ? { status } : {}),
        offset: 0,
        limit: 100
      });
      setItems(result.items);
    } catch (error) {
      console.error(error);
      setErrorMessage("دریافت درخواست‌های تأیید با خطا مواجه شد.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="temporary-page approval-page">
      <header className="approval-page__header">
        <div>
          <h1>گردش تأیید</h1>
          <p>مشاهده و پیگیری درخواست‌های تأیید اسناد و عملیات.</p>
        </div>
        <Link to="/dashboard">بازگشت به داشبورد</Link>
      </header>

      <form className="approval-card approval-filters" onSubmit={(event) => { event.preventDefault(); void load(); }}>
        <label>
          جستجو
          <input value={text} onChange={(event) => setText(event.target.value)} placeholder="عنوان، نوع درخواست یا سند" />
        </label>
        <label>
          وضعیت
          <select value={status} onChange={(event) => setStatus(event.target.value as ApprovalStatus | "")}>
            <option value="">همه وضعیت‌ها</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="submit" disabled={isLoading}>اعمال فیلتر</button>
      </form>

      {errorMessage && <p className="approval-message approval-message--error">{errorMessage}</p>}

      <div className="approval-card">
        {isLoading ? <p>در حال دریافت اطلاعات...</p> : items.length === 0 ? <p>درخواستی یافت نشد.</p> : (
          <table className="approval-table">
            <thead><tr><th>عنوان</th><th>نوع</th><th>سند مرتبط</th><th>درخواست‌کننده</th><th>وضعیت</th><th>آخرین تغییر</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} onClick={() => navigate(`/approval/requests/${item.id}`)}>
                  <td>{item.title}</td>
                  <td>{item.requestType}</td>
                  <td>{item.entityDisplayName ?? `${item.entityType} / ${item.entityId}`}</td>
                  <td>{item.requestedByDisplayName ?? "سیستم"}</td>
                  <td><span className="approval-status">{statusLabels[item.status]}</span></td>
                  <td>{new Date(item.updatedAt).toLocaleString("fa-IR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
