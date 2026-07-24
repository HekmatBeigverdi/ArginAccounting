import {
  type FormEvent,
  useEffect,
  useState
} from "react";

import type {
  AuditAction,
  AuditEntrySummary,
  AuditOutcome
} from "@argin/audit";

import {
  Link
} from "react-router";

import {
  useAuditServices
} from "../../composition/audit";

import "./audit-pages.css";

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
  view: "مشاهده"
};

const outcomeLabels: Record<string, string> = {
  success: "موفق",
  failure: "ناموفق",
  denied: "رد دسترسی"
};

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

  async function load(): Promise<void> {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const result = await searchAuditEntries({
        ...(text.trim() ? { text: text.trim() } : {}),
        ...(action ? { action: action as AuditAction } : {}),
        ...(outcome ? { outcome: outcome as AuditOutcome } : {}),
        ...(entityType.trim() ? { entityType: entityType.trim() } : {}),
        offset: 0,
        limit: 100
      });

      setItems(result.items);
      setTotalCount(result.totalCount);
    } catch (error) {
      console.error(error);
      setErrorMessage("دریافت گزارش ممیزی با خطا مواجه شد.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void load();
  }

  return (
    <section className="audit-page">
      <header className="audit-page__header">
        <div>
          <h1>گزارش ممیزی</h1>
          <p>ردیابی عملیات کاربران، سیستم و یکپارچه‌سازی‌ها</p>
        </div>
        <span>{totalCount.toLocaleString("fa-IR")} رویداد</span>
      </header>

      <form className="audit-filters" onSubmit={handleSubmit}>
        <input
          value={text}
          placeholder="جستجو در پیام، دلیل یا شناسه..."
          onChange={(event) => setText(event.target.value)}
        />
        <select value={action} onChange={(event) => setAction(event.target.value)}>
          <option value="">همه عملیات‌ها</option>
          {Object.entries(actionLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
          <option value="">همه نتایج</option>
          {Object.entries(outcomeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input
          value={entityType}
          placeholder="نوع موجودیت"
          onChange={(event) => setEntityType(event.target.value)}
        />
        <button type="submit">اعمال فیلتر</button>
      </form>

      {errorMessage && <p className="audit-message audit-message--error">{errorMessage}</p>}
      {isLoading && <p className="audit-message">در حال دریافت رویدادها...</p>}
      {!isLoading && !errorMessage && items.length === 0 && (
        <p className="audit-message">رویدادی مطابق فیلترها یافت نشد.</p>
      )}

      {!isLoading && items.length > 0 && (
        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>زمان</th>
                <th>عملیات</th>
                <th>نتیجه</th>
                <th>عامل</th>
                <th>موجودیت</th>
                <th>منبع</th>
                <th>جزئیات</th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.occurredAt).toLocaleString("fa-IR")}</td>
                  <td>{actionLabels[entry.action] ?? entry.action}</td>
                  <td>
                    <span className={`audit-badge audit-badge--${entry.outcome}`}>
                      {outcomeLabels[entry.outcome] ?? entry.outcome}
                    </span>
                  </td>
                  <td>{entry.actor.displayName}</td>
                  <td>
                    <strong>{entry.target.entityDisplayName ?? entry.target.entityType}</strong>
                    {entry.target.entityId && <small>{entry.target.entityId}</small>}
                  </td>
                  <td>{entry.source}</td>
                  <td><Link to={`/audit/entries/${entry.id}`}>مشاهده</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
