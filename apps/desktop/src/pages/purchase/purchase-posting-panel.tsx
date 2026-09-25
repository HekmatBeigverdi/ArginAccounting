import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  PurchasePostingReconciliationIssue,
  PurchasePostingReconciliationSnapshot,
  PurchasePostingSourceDocumentType,
} from "@argin/purchase-posting";
import type {
  PurchasePostingWorkspaceServices,
} from "../../composition/purchase-posting/create-purchase-posting-workspace-services";

const STATUS: Record<string, string> = {
  draft: "پیش‌نویس",
  prepared: "آماده",
  posted: "ثبت‌شده",
  reversed: "برگشت‌شده",
};

const JOURNAL_STATUS: Record<string, string> = {
  draft: "پیش‌نویس",
  submitted: "ارسال‌شده",
  approved: "تأییدشده",
  posted: "ثبت نهایی",
  reversed: "برگشت‌شده",
};

const ISSUE_LABELS: Record<PurchasePostingReconciliationIssue, string> = {
  "posting-missing": "رکورد ثبت خرید یافت نشد.",
  "journal-missing": "سند حسابداری مرتبط یافت نشد.",
  "source-mismatch": "منبع سند حسابداری با سند خرید تطابق ندارد.",
  "company-mismatch": "شرکت در زنجیره ثبت حسابداری ناسازگار است.",
  "branch-mismatch": "شعبه در زنجیره ثبت حسابداری ناسازگار است.",
  "journal-unbalanced": "سند حسابداری تراز نیست.",
  "posting-state-mismatch": "وضعیت ثبت خرید و سند حسابداری با هم سازگار نیست.",
  "reversal-lineage-missing": "ردیابی برگشت ثبت یافت نشد.",
  "reversal-journal-missing": "سند حسابداری برگشت یافت نشد.",
  "reversal-journal-invalid": "سند حسابداری برگشت با ردیابی ثبت تطابق ندارد.",
};

function postingHint(
  documentType: PurchasePostingSourceDocumentType,
  status: string,
  canExecute: boolean,
): string {
  if (documentType === "purchase-order") {
    return "سفارش خرید اثر حسابداری مستقیم ندارد.";
  }
  if (status !== "confirmed") {
    return "ثبت حسابداری بعد از قطعی‌شدن سند خرید قابل ایجاد است.";
  }
  if (!canExecute) {
    return "سند آماده ثبت حسابداری است، اما کاربر مجوز ایجاد ثبت خرید را ندارد.";
  }
  return "سند از نظر UI آماده ثبت حسابداری است. ایجاد Journal باید فقط از سرویس Application انجام شود و این صفحه هیچ مبلغ یا حسابی را دوباره محاسبه نمی‌کند.";
}

export function PurchasePostingPanel(props: {
  readonly services: PurchasePostingWorkspaceServices | null;
  readonly companyId: string;
  readonly branchId: string;
  readonly sourceType: PurchasePostingSourceDocumentType;
  readonly sourceId: string;
  readonly sourceStatus: string;
}) {
  const [rows, setRows] = useState<readonly PurchasePostingReconciliationSnapshot[]>([]);
  const [selectedPostingId, setSelectedPostingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!props.services?.canView) return;
    setLoading(true);
    setError("");
    try {
      const result = await props.services.findBySource({
        companyId: props.companyId,
        branchId: props.branchId,
        sourceType: props.sourceType,
        sourceId: props.sourceId,
      });
      setRows(result);
      setSelectedPostingId(current =>
        current && result.some(row => row.posting?.postingId === current)
          ? current
          : result[0]?.posting?.postingId ?? null,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "خواندن ثبت حسابداری ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, [props.services, props.companyId, props.branchId, props.sourceType, props.sourceId]);

  useEffect(() => { void reload(); }, [reload]);

  const selected = useMemo(
    () => rows.find(row => row.posting?.postingId === selectedPostingId) ?? rows[0] ?? null,
    [rows, selectedPostingId],
  );

  if (!props.services?.canView) {
    return null;
  }

  return (
    <section className="purchase-posting-panel" aria-label="ثبت حسابداری خرید">
      <header className="purchase-posting-panel__header">
        <div>
          <h3>ثبت حسابداری خرید</h3>
          <p>مسیر ثبت از سند خرید تا دفتر کل، بدون ورود مجدد اطلاعات.</p>
        </div>
        <button type="button" disabled={loading} onClick={() => void reload()}>
          {loading ? "در حال بازخوانی…" : "بازخوانی ثبت"}
        </button>
      </header>

      {error && <div className="purchase-posting-panel__error">{error}</div>}

      {!loading && rows.length === 0 && (
        <div className="purchase-posting-panel__empty">
          <strong>هنوز ثبت حسابداری ایجاد نشده است.</strong>
          <span>{postingHint(props.sourceType, props.sourceStatus, props.services.canExecute)}</span>
        </div>
      )}

      {rows.length > 1 && (
        <label className="purchase-posting-panel__selector">
          نسخه ثبت
          <select
            value={selectedPostingId ?? ""}
            onChange={event => setSelectedPostingId(event.target.value)}
          >
            {rows.map(row => (
              <option
                key={row.posting?.postingId ?? row.source.sourceVersion}
                value={row.posting?.postingId ?? ""}
              >
                نسخه منبع {row.source.sourceVersion}
                {row.source.sourceRevision == null ? "" : ` / بازنگری ${row.source.sourceRevision}`}
              </option>
            ))}
          </select>
        </label>
      )}

      {selected && (
        <>
          <div className="purchase-posting-panel__summary">
            <div>
              <span>وضعیت ثبت</span>
              <strong>{selected.posting ? STATUS[selected.posting.status] ?? selected.posting.status : "یافت نشد"}</strong>
            </div>
            <div>
              <span>سند حسابداری</span>
              <strong>{selected.journal?.number ?? "یافت نشد"}</strong>
              {selected.journal && <small>{JOURNAL_STATUS[selected.journal.status] ?? selected.journal.status}</small>}
            </div>
            <div>
              <span>تراز سند</span>
              <strong>
                {selected.journal
                  ? `${selected.journal.totalDebit.amount.toLocaleString("fa-IR")} ریال`
                  : "—"}
              </strong>
            </div>
            <div>
              <span>کنترل تطبیق</span>
              <strong>{selected.reconciled ? "سالم" : "نیازمند بررسی"}</strong>
            </div>
          </div>

          {!selected.reconciled && (
            <ul className="purchase-posting-panel__issues">
              {selected.issues.map(issue => <li key={issue}>{ISSUE_LABELS[issue]}</li>)}
            </ul>
          )}

          {props.services.canTrace && (
            <details className="purchase-posting-trace">
              <summary>نمایش مسیر ردیابی</summary>
              <ol>
                <li>
                  <span>سند خرید</span>
                  <bdi>{selected.source.sourceId}</bdi>
                  <small>نسخه {selected.source.sourceVersion}</small>
                </li>
                <li>
                  <span>Purchase Posting</span>
                  <bdi>{selected.posting?.postingId ?? "—"}</bdi>
                  <small>{selected.posting ? STATUS[selected.posting.status] : "یافت نشد"}</small>
                </li>
                <li>
                  <span>سند حسابداری</span>
                  <bdi>{selected.journal?.number ?? selected.journal?.id ?? "—"}</bdi>
                  <small>{selected.journal ? `${selected.journal.lines.length} ردیف` : "یافت نشد"}</small>
                </li>
                {selected.reversal && (
                  <li>
                    <span>سند برگشت</span>
                    <bdi>{selected.reversalJournal?.number ?? selected.reversal.reversalJournalVoucherId}</bdi>
                    <small>{selected.reversalJournal ? JOURNAL_STATUS[selected.reversalJournal.status] : "یافت نشد"}</small>
                  </li>
                )}
              </ol>

              {selected.journal && (
                <div className="purchase-posting-trace__lines">
                  <h4>ردیف‌های سند حسابداری</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>ردیف</th>
                        <th>حساب</th>
                        <th>بدهکار</th>
                        <th>بستانکار</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.journal.lines.map(line => (
                        <tr key={line.id}>
                          <td>{line.order}</td>
                          <td><bdi>{line.accountId}</bdi></td>
                          <td>{line.debit.amount.toLocaleString("fa-IR")}</td>
                          <td>{line.credit.amount.toLocaleString("fa-IR")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>
          )}
        </>
      )}
    </section>
  );
}
