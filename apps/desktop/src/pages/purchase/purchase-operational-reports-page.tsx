import { type FormEvent, useEffect, useState } from "react";
import type {
  PurchaseDocumentRegisterReport,
  PurchaseInvoiceMatchingReport,
  PurchaseSupplierActivitySummaryReport,
  PurchaseUnresolvedCostReport,
} from "@argin/purchase";
import type { PartySelectorDto } from "@argin/party";
import { getDesktopDatabase } from "@argin/database-tauri";
import { useActiveContext } from "../../app/providers/active-context-provider";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import {
  createPurchaseReportServices,
  type PurchaseReportServices,
} from "../../composition/purchase/create-purchase-report-services";
import { Feedback } from "../../components/feedback";
import { Page } from "../../components/layout";
import "./purchase-operational-reports-page.css";

type ReportTab = "register" | "suppliers" | "matching" | "unresolved";

const PAGE_SIZE = 50;
const REPORT_TABS: readonly { id: ReportTab; label: string }[] = [
  { id: "register", label: "دفتر اسناد خرید" },
  { id: "suppliers", label: "خلاصه تأمین‌کنندگان" },
  { id: "matching", label: "تطبیق فاکتور و رسید" },
  { id: "unresolved", label: "هزینه‌های حل‌نشده" },
];

const TYPE_LABELS = {
  "purchase-order": "سفارش خرید",
  "supplier-invoice": "فاکتور تأمین‌کننده",
  "purchase-return": "برگشت از خرید",
  "purchase-correction": "اصلاح خرید",
} as const;
const STATUS_LABELS = {
  draft: "پیش‌نویس",
  submitted: "ارسال‌شده",
  approved: "تأییدشده",
  confirmed: "قطعی",
  cancelled: "لغوشده",
  returned: "برگشت‌شده",
  corrected: "اصلاح‌شده",
} as const;
const MATCH_LABELS = {
  unmatched: "بدون تطبیق",
  "partially-matched": "تطبیق جزئی",
  "fully-matched": "تطبیق کامل",
} as const;
const COST_REASON_LABELS = {
  "awaiting-supplier-invoice": "در انتظار فاکتور تأمین‌کننده",
  "partial-invoice-match": "تطبیق فاکتور ناقص",
  "supplier-invoice-cost-unavailable": "هزینه معتبر فاکتور در دسترس نیست",
} as const;

const persianDateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const amountFormatter = new Intl.NumberFormat("fa-IR");

const latinDigits = (value: string): string =>
  value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
const div = (a: number, b: number) => Math.trunc(a / b);
const mod = (a: number, b: number) => a - Math.trunc(a / b) * b;
function calculateJalaliYear(jy: number) {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
    2192, 2262, 2324, 2394, 2456, 3178,
  ];
  let leapJ = -14,
    jp = breaks[0]!,
    jump = 0;
  if (jy < jp || jy >= breaks[breaks.length - 1]!)
    throw new Error("تاریخ شمسی خارج از محدوده مجاز است.");
  for (let i = 1; i < breaks.length; i += 1) {
    const jm = breaks[i]!;
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const gy = jy + 621;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}
function gregorianToDayNumber(gy: number, gm: number, gd: number) {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}
function dayNumberToGregorian(jdn: number) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}
function jalaliToDayNumber(jy: number, jm: number, jd: number) {
  const r = calculateJalaliYear(jy);
  return (
    gregorianToDayNumber(r.gy, 3, r.march) +
    (jm - 1) * 31 -
    div(jm, 7) * (jm - 7) +
    jd -
    1
  );
}
function dayNumberToJalali(jdn: number) {
  const g = dayNumberToGregorian(jdn);
  let jy = g.gy - 621;
  const r = calculateJalaliYear(jy);
  const first = gregorianToDayNumber(g.gy, 3, r.march);
  let k = jdn - first;
  let jm: number, jd: number;
  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}
function gregorianToJalali(value: string): string {
  const [gy, gm, gd] = value.split("-").map(Number);
  if (!gy || !gm || !gd) return "";
  const j = dayNumberToJalali(gregorianToDayNumber(gy, gm, gd));
  return (
    j.jy +
    "/" +
    String(j.jm).padStart(2, "0") +
    "/" +
    String(j.jd).padStart(2, "0")
  );
}
function jalaliToGregorian(value: string): string {
  const normalized = latinDigits(value).trim().replace(/-/g, "/");
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalized);
  if (!match) throw new Error("تاریخ را به‌صورت ۱۴۰۵/۰۶/۲۹ وارد کنید.");
  const jy = Number(match[1]),
    jm = Number(match[2]),
    jd = Number(match[3]);
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31)
    throw new Error("تاریخ شمسی معتبر نیست.");
  const jdn = jalaliToDayNumber(jy, jm, jd);
  const round = dayNumberToJalali(jdn);
  if (round.jy !== jy || round.jm !== jm || round.jd !== jd)
    throw new Error("تاریخ شمسی معتبر نیست.");
  const g = dayNumberToGregorian(jdn);
  return (
    g.gy +
    "-" +
    String(g.gm).padStart(2, "0") +
    "-" +
    String(g.gd).padStart(2, "0")
  );
}

const errorMessage = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : "بارگذاری گزارش خرید با خطا مواجه شد.";

export function PurchaseOperationalReportsPage() {
  const active = useActiveContext();
  const { session } = useAuthSession();
  const [services, setServices] = useState<PurchaseReportServices | null>(null);
  const [suppliers, setSuppliers] = useState<readonly PartySelectorDto[]>([]);
  const [tab, setTab] = useState<ReportTab>("register");
  const [supplierId, setSupplierId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [register, setRegister] =
    useState<PurchaseDocumentRegisterReport | null>(null);
  const [supplierSummary, setSupplierSummary] =
    useState<PurchaseSupplierActivitySummaryReport | null>(null);
  const [matching, setMatching] =
    useState<PurchaseInvoiceMatchingReport | null>(null);
  const [unresolved, setUnresolved] =
    useState<PurchaseUnresolvedCostReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getDesktopDatabase()
      .then((database) => {
        if (cancelled || !session) return;
        setServices(
          createPurchaseReportServices({
            database,
            actor: {
              permissions: session.user.permissions,
              branchIds: session.user.branchIds,
            },
          }),
        );
      })
      .catch((reason) => !cancelled && setError(errorMessage(reason)));
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!services || !active.companyId) return;
    void services
      .selectSuppliers(active.companyId)
      .then(setSuppliers)
      .catch((reason) => setError(errorMessage(reason)));
  }, [services, active.companyId]);

  const loadReport = async (nextPage = page) => {
    if (!services || !active.companyId || !active.fiscalYearId) return;
    setLoading(true);
    setError("");
    try {
      const reportQuery = {
        companyId: active.companyId,
        branchId: active.branchId || null,
        fiscalYearId: active.fiscalYearId || null,
        supplierId: tab === "unresolved" ? null : supplierId || null,
        fromBusinessDate: dateFrom ? jalaliToGregorian(dateFrom) : null,
        toBusinessDate: dateTo ? jalaliToGregorian(dateTo) : null,
        limit: PAGE_SIZE,
        offset: nextPage * PAGE_SIZE,
      };
      switch (tab) {
        case "register":
          setRegister(await services.readDocumentRegister(reportQuery));
          break;
        case "suppliers":
          setSupplierSummary(await services.readSupplierActivity(reportQuery));
          break;
        case "matching":
          setMatching(await services.readInvoiceMatching(reportQuery));
          break;
        case "unresolved":
          setUnresolved(await services.readUnresolvedCosts(reportQuery));
          break;
      }
      setPage(nextPage);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (services && active.companyId && active.fiscalYearId) void loadReport(0);
  }, [services, active.companyId, active.branchId, active.fiscalYearId, tab]);

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    void loadReport(0);
  };

  const hasNextPageByTab: Record<ReportTab, boolean> = {
    register: register?.nextOffset !== null,
    suppliers: (supplierSummary?.items.length ?? 0) === PAGE_SIZE,
    matching: matching?.nextOffset !== null,
    unresolved: unresolved?.nextOffset !== null,
  };
  const hasNext = hasNextPageByTab[tab];

  const selectTab = (nextTab: ReportTab) => {
    setTab(nextTab);
    setPage(0);
  };

  return (
    <Page>
      <div className="purchase-reports" dir="rtl">
        <header className="purchase-reports__header">
          <div>
            <h1>گزارش‌های خرید</h1>
            <p>
              گزارش‌های عملیاتی مبتنی بر اسناد، تطبیق رسید/فاکتور و وضعیت هزینه
              موجودی
            </p>
          </div>
        </header>

        {!services?.canView && services && (
          <Feedback tone="error">
            برای مشاهده گزارش‌های خرید مجوز کافی ندارید.
          </Feedback>
        )}
        {error && <Feedback tone="error">{error}</Feedback>}
        {!active.companyId || !active.fiscalYearId ? (
          <Feedback tone="warning">
            شرکت و سال مالی فعال را انتخاب کنید.
          </Feedback>
        ) : (
          <>
            <nav
              className="purchase-report-tabs"
              aria-label="گزارش‌های عملیاتی خرید"
            >
              {REPORT_TABS.map((reportTab) => (
                <button
                  key={reportTab.id}
                  className={tab === reportTab.id ? "is-active" : ""}
                  onClick={() => selectTab(reportTab.id)}
                >
                  {reportTab.label}
                </button>
              ))}
            </nav>

            <form className="purchase-report-filters" onSubmit={applyFilters}>
              <label>
                تأمین‌کننده
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="">همه تأمین‌کنندگان</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.code} — {supplier.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                از تاریخ شمسی
                <input
                  dir="ltr"
                  inputMode="numeric"
                  placeholder="۱۴۰۵/۰۶/۰۱"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </label>
              <label>
                تا تاریخ شمسی
                <input
                  dir="ltr"
                  inputMode="numeric"
                  placeholder="۱۴۰۵/۰۶/۳۱"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </label>
              <button type="submit" disabled={loading}>
                اعمال فیلتر
              </button>
            </form>

            <div className="purchase-report-table-wrap">
              {tab === "register" && (
                <table className="purchase-report-table">
                  <thead>
                    <tr>
                      <th>تاریخ</th>
                      <th>شماره</th>
                      <th>نوع</th>
                      <th>تأمین‌کننده</th>
                      <th>وضعیت</th>
                      <th>خالص</th>
                      <th>مالیات</th>
                      <th>مبلغ نهایی</th>
                    </tr>
                  </thead>
                  <tbody>
                    {register?.items.map((row) => (
                      <tr key={row.documentId}>
                        <td>
                          {persianDateFormatter.format(
                            new Date(row.businessDate + "T00:00:00Z"),
                          )}
                        </td>
                        <td dir="ltr">{row.documentNumber ?? "—"}</td>
                        <td>{TYPE_LABELS[row.documentType]}</td>
                        <td>{row.supplierDisplayName}</td>
                        <td>{STATUS_LABELS[row.status]}</td>
                        <td>
                          {amountFormatter.format(row.taxBaseAmount)}{" "}
                          {row.currency}
                        </td>
                        <td>
                          {amountFormatter.format(row.taxAmount)} {row.currency}
                        </td>
                        <td>
                          <strong>
                            {amountFormatter.format(row.grandTotal)}{" "}
                            {row.currency}
                          </strong>
                        </td>
                      </tr>
                    ))}
                    {!loading && !register?.items.length && (
                      <tr>
                        <td colSpan={8}>سندی مطابق فیلتر وجود ندارد.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {tab === "suppliers" && (
                <table className="purchase-report-table">
                  <thead>
                    <tr>
                      <th>تأمین‌کننده</th>
                      <th>فاکتور</th>
                      <th>برگشت</th>
                      <th>اصلاح</th>
                      <th>جمع فاکتورها</th>
                      <th>جمع برگشت</th>
                      <th>خالص قبل از اصلاح</th>
                      <th>مبلغ اسناد اصلاحی</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierSummary?.items.map((row) => (
                      <tr key={row.supplierId + row.currency}>
                        <td>
                          {row.supplierCode} — {row.supplierDisplayName}
                        </td>
                        <td>{row.invoiceCount}</td>
                        <td>{row.returnCount}</td>
                        <td>{row.correctionCount}</td>
                        <td>
                          {amountFormatter.format(row.invoiceGrandTotal)}{" "}
                          {row.currency}
                        </td>
                        <td>
                          {amountFormatter.format(row.returnGrandTotal)}{" "}
                          {row.currency}
                        </td>
                        <td>
                          <strong>
                            {amountFormatter.format(row.netBeforeCorrections)}{" "}
                            {row.currency}
                          </strong>
                        </td>
                        <td>
                          {amountFormatter.format(row.correctionGrandTotal)}{" "}
                          {row.currency}
                        </td>
                      </tr>
                    ))}
                    {!loading && !supplierSummary?.items.length && (
                      <tr>
                        <td colSpan={8}>
                          فعالیت خریدی برای تأمین‌کنندگان یافت نشد.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {tab === "matching" && (
                <table className="purchase-report-table">
                  <thead>
                    <tr>
                      <th>فاکتور</th>
                      <th>تاریخ</th>
                      <th>تأمین‌کننده</th>
                      <th>کالا</th>
                      <th>مقدار فاکتور</th>
                      <th>تطبیق‌شده</th>
                      <th>باقی‌مانده</th>
                      <th>وضعیت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matching?.items.map((row) => (
                      <tr key={row.invoiceLineId}>
                        <td dir="ltr">
                          {row.invoiceDocumentNumber ?? row.invoiceDocumentId}
                        </td>
                        <td>{gregorianToJalali(row.businessDate)}</td>
                        <td>{row.supplierDisplayName}</td>
                        <td>
                          {row.productCode} — {row.productDisplayName}
                        </td>
                        <td dir="ltr">
                          {row.invoiceBaseQuantity} {row.unitTitle}
                        </td>
                        <td dir="ltr">{row.matchedBaseQuantity}</td>
                        <td dir="ltr">{row.remainingBaseQuantity}</td>
                        <td>{MATCH_LABELS[row.status]}</td>
                      </tr>
                    ))}
                    {!loading && !matching?.items.length && (
                      <tr>
                        <td colSpan={8}>ردیف فاکتوری برای تطبیق یافت نشد.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {tab === "unresolved" && (
                <table className="purchase-report-table">
                  <thead>
                    <tr>
                      <th>رسید انبار</th>
                      <th>تاریخ</th>
                      <th>کالا</th>
                      <th>انبار</th>
                      <th>مقدار</th>
                      <th>علت حل‌نشدن هزینه</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unresolved?.items.map((row) => (
                      <tr key={row.movementId}>
                        <td dir="ltr">
                          {row.receiptDocumentNumber ?? row.receiptDocumentId}
                        </td>
                        <td>{gregorianToJalali(row.businessDate)}</td>
                        <td>
                          {row.productCode} — {row.productTitle}
                        </td>
                        <td>
                          {row.warehouseCode} — {row.warehouseTitle}
                        </td>
                        <td dir="ltr">{row.quantity}</td>
                        <td>{COST_REASON_LABELS[row.reason]}</td>
                      </tr>
                    ))}
                    {!loading && !unresolved?.items.length && (
                      <tr>
                        <td colSpan={6}>
                          هزینه حل‌نشده‌ای مطابق فیلتر وجود ندارد.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <footer className="purchase-report-pagination">
              <button
                type="button"
                disabled={page === 0 || loading}
                onClick={() => void loadReport(Math.max(0, page - 1))}
              >
                قبلی
              </button>
              <span>صفحه {page + 1}</span>
              <button
                type="button"
                disabled={!hasNext || loading}
                onClick={() => void loadReport(page + 1)}
              >
                بعدی
              </button>
            </footer>
          </>
        )}
      </div>
    </Page>
  );
}
