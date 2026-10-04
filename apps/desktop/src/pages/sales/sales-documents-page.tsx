import { useEffect, useMemo, useState } from "react";
import type { SalesDocumentSnapshot, SalesDocumentStatus } from "@argin/sales";
import { salesPermissions } from "@argin/sales";
import { getDesktopDatabase } from "@argin/database-tauri";
import "@argin/sales-tauri";
import { useActiveContext } from "../../app/providers/active-context-provider";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { Page } from "../../components/layout";
import { Feedback } from "../../components/feedback";
import "./sales-documents-page.css";

const TYPE_LABELS: Record<SalesDocumentSnapshot["documentType"], string> = {
  "sales-order": "سفارش فروش",
  "sales-invoice": "فاکتور فروش",
  "sales-return": "برگشت از فروش",
  "sales-correction": "اصلاح فروش",
};

const STATUS_LABELS: Record<SalesDocumentStatus, string> = {
  draft: "پیش‌نویس",
  submitted: "ارسال‌شده",
  approved: "تأییدشده",
  finalized: "قطعی",
  cancelled: "لغوشده",
};

const persianDateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const numberFormatter = new Intl.NumberFormat("fa-IR");

function formatBusinessDate(value: string) {
  const date = new Date(value + "T00:00:00");
  return Number.isNaN(date.getTime()) ? value : persianDateFormatter.format(date);
}

function calculateLineTotal(line: SalesDocumentSnapshot["lines"][number]) {
  const terms = line.commercialTerms;
  if (!terms) return 0;

  const grossAmount = terms.quantity * terms.unitPrice;
  const discountTotal = terms.discounts.reduce(
    (total, discount) =>
      total +
      (discount.mode === "amount"
        ? discount.value
        : Math.round((grossAmount * discount.value) / 10000)),
    0,
  );
  const netAmount = grossAmount - discountTotal;
  const chargeTotal = terms.charges.reduce(
    (total, charge) =>
      total +
      (charge.mode === "amount"
        ? charge.value
        : Math.round((netAmount * charge.value) / 10000)),
    0,
  );
  const taxableAmount = netAmount + chargeTotal;
  const taxTotal = terms.taxes.reduce(
    (total, tax) =>
      total + Math.round((taxableAmount * tax.rateBasisPoints) / 10000),
    0,
  );

  return taxableAmount + taxTotal;
}

export function SalesDocumentsPage() {
  const activeContext = useActiveContext();
  const { session } = useAuthSession();
  const [documents, setDocuments] = useState<readonly SalesDocumentSnapshot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const hasPermission = (permission: string) =>
    Boolean(
      session?.user.permissions.includes("system.full-access") ||
        session?.user.permissions.includes(permission),
    );

  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      if (!activeContext.companyId || !session) return;

      try {
        const database = await getDesktopDatabase();
        const rows = await database.query<{ document_json: string }>(
          "SELECT document_json FROM sales_documents WHERE company_id=? ORDER BY business_date DESC,updated_at DESC",
          [activeContext.companyId],
        );
        if (cancelled) return;

        const loadedDocuments = rows.map(
          (row) => JSON.parse(row.document_json) as SalesDocumentSnapshot,
        );
        setDocuments(loadedDocuments);
        setSelectedId((currentId) =>
          currentId && loadedDocuments.some((document) => document.documentId === currentId)
            ? currentId
            : loadedDocuments[0]?.documentId ?? null,
        );
      } catch (error) {
        if (!cancelled) {
          setError(
            error instanceof Error
              ? error.message
              : "بارگذاری اسناد فروش ناموفق بود.",
          );
        }
      }
    }

    void loadDocuments();
    return () => {
      cancelled = true;
    };
  }, [activeContext.companyId, session]);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fa");
    if (!query) return documents;

    return documents.filter((document) =>
      [
        document.documentNumber,
        document.customer.displayName,
        document.customer.code,
        TYPE_LABELS[document.documentType],
      ].some((value) => value?.toLocaleLowerCase("fa").includes(query)),
    );
  }, [documents, search]);

  const selectedDocument =
    documents.find((document) => document.documentId === selectedId) ?? null;
  const documentTotal =
    selectedDocument?.lines.reduce(
      (total, line) => total + calculateLineTotal(line),
      0,
    ) ?? 0;

  return (
    <Page>
      <div className="sales-workspace" dir="rtl">
        <header className="sales-workspace__toolbar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جست‌وجو در شماره سند، مشتری یا نوع سند"
            aria-label="جست‌وجوی اسناد فروش"
          />
          <button className="primary" disabled={!hasPermission(salesPermissions.create)}>
            سند فروش جدید
          </button>
        </header>

        {error && <Feedback tone="error">{error}</Feedback>}

        <div className="sales-workspace__grid">
          <section className="sales-list" aria-label="فهرست اسناد فروش">
            <div className="sales-list__header">
              <span>تاریخ</span>
              <span>سند / مشتری</span>
              <span>وضعیت</span>
            </div>
            <div className="sales-list__scroll">
              {filteredDocuments.map((document) => {
                const isSelected = selectedId === document.documentId;

                return (
                  <button
                    key={document.documentId}
                    className={"sales-list__row " + (isSelected ? "is-active" : "")}
                    onClick={() => setSelectedId(document.documentId)}
                  >
                    <span>{formatBusinessDate(document.businessDate)}</span>
                    <span>
                      <strong>{document.documentNumber ?? "بدون شماره"}</strong>
                      <small>
                        {TYPE_LABELS[document.documentType]} · {document.customer.displayName}
                      </small>
                    </span>
                    <span className={"status status--" + (isSelected ? "active" : "normal")}>
                      {STATUS_LABELS.draft}
                    </span>
                  </button>
                );
              })}
              {filteredDocuments.length === 0 && (
                <div className="empty">سند فروشی برای نمایش وجود ندارد.</div>
              )}
            </div>
          </section>

          <section className="sales-detail">
            {selectedDocument ? (
              <>
                <header>
                  <div>
                    <h2>
                      {selectedDocument.documentNumber ?? TYPE_LABELS[selectedDocument.documentType]}
                    </h2>
                    <div className="meta">
                      <span>{TYPE_LABELS[selectedDocument.documentType]}</span>
                      <span>مشتری: {selectedDocument.customer.displayName}</span>
                      <span>تاریخ: {formatBusinessDate(selectedDocument.businessDate)}</span>
                    </div>
                  </div>
                </header>

                <div className="sales-detail__actions">
                  <button disabled={!hasPermission(salesPermissions.edit)}>ویرایش</button>
                  <button disabled={!hasPermission(salesPermissions.submit)}>ارسال برای تأیید</button>
                  <button disabled={!hasPermission(salesPermissions.approve)}>تأیید</button>
                  <button disabled={!hasPermission(salesPermissions.finalize)}>قطعی‌کردن</button>
                  <button disabled={!hasPermission(salesPermissions.cancel)}>لغو</button>
                </div>

                <div className="sales-summary">
                  <div>
                    <span>مشتری</span>
                    <strong>{selectedDocument.customer.displayName}</strong>
                  </div>
                  <div>
                    <span>تعداد اقلام</span>
                    <strong>{numberFormatter.format(selectedDocument.lines.length)}</strong>
                  </div>
                  <div>
                    <span>جمع فروش</span>
                    <strong dir="ltr">
                      {numberFormatter.format(documentTotal)} {selectedDocument.lines[0]?.commercialTerms?.currency ?? ""}
                    </strong>
                  </div>
                </div>

                <div className="sales-lines-wrap">
                  <table className="sales-lines">
                    <thead>
                      <tr>
                        <th>ردیف</th>
                        <th>کالا / خدمت</th>
                        <th>نوع</th>
                        <th>تعداد</th>
                        <th>قیمت واحد</th>
                        <th>تخفیف</th>
                        <th>مالیات</th>
                        <th>جمع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDocument.lines.map((line) => {
                        const terms = line.commercialTerms;

                        return (
                          <tr key={line.lineId}>
                            <td>{numberFormatter.format(line.position)}</td>
                            <td>
                              <strong>{line.description || line.item.productId}</strong>
                              <small dir="ltr">{line.item.productId}</small>
                            </td>
                            <td>{line.lineKind === "service" ? "خدمت" : "کالا"}</td>
                            <td dir="ltr">{terms?.quantity ?? "-"}</td>
                            <td dir="ltr">{terms ? numberFormatter.format(terms.unitPrice) : "-"}</td>
                            <td>{terms?.discounts.length ?? 0}</td>
                            <td>{terms?.taxes.length ?? 0}</td>
                            <td dir="ltr">{numberFormatter.format(calculateLineTotal(line))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <details className="sales-history">
                  <summary>ردیابی و ارتباطات سند</summary>
                  <dl>
                    <dt>شناسه پایدار سند</dt>
                    <dd dir="ltr">{selectedDocument.documentId}</dd>
                    <dt>سند مرتبط</dt>
                    <dd dir="ltr">{selectedDocument.relatedDocumentReference?.documentId ?? "—"}</dd>
                    <dt>منبع سند</dt>
                    <dd dir="ltr">{selectedDocument.sourceReference?.sourceDocumentId ?? "—"}</dd>
                  </dl>
                </details>
              </>
            ) : (
              <div className="empty">یک سند فروش را انتخاب کنید.</div>
            )}
          </section>
        </div>
      </div>
    </Page>
  );
}
