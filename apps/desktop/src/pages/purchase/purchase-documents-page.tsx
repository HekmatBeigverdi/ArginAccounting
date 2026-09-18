import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  PurchaseApplicationError,
  purchasePermissions,
  type PurchaseDocumentSnapshot,
  type PurchaseDocumentStatus,
  type PurchaseDocumentType,
} from "@argin/purchase";
import { getDesktopDatabase } from "@argin/database-tauri";
import type { PartySelectorDto } from "@argin/party";
import type { ProductDto, ProductSelectorItemDto } from "@argin/product";
import type { WarehouseListItemDto } from "@argin/warehouse";
import { useActiveContext } from "../../app/providers/active-context-provider";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { useAuditServices } from "../../composition/audit";
import {
  createPurchaseWorkspaceServices,
  type PurchaseWorkspaceDetail,
  type PurchaseWorkspaceLineInput,
  type PurchaseWorkspaceServices,
} from "../../composition/purchase/create-purchase-workspace-services";
import { Feedback } from "../../components/feedback";
import { Page } from "../../components/layout";
import "./purchase-documents-page.css";

const TYPE_LABELS: Record<PurchaseDocumentType, string> = {
  "purchase-order": "سفارش خرید",
  "supplier-invoice": "فاکتور تأمین‌کننده",
  "purchase-return": "برگشت از خرید",
  "purchase-correction": "اصلاح خرید",
};
const STATUS_LABELS: Record<PurchaseDocumentStatus, string> = {
  draft: "پیش‌نویس",
  submitted: "ارسال‌شده",
  approved: "تأییدشده",
  confirmed: "قطعی",
  cancelled: "لغوشده",
  returned: "برگشت‌شده",
  corrected: "اصلاح‌شده",
};
const faDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const faDateTime = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const money = new Intl.NumberFormat("fa-IR");

const latinDigits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
const div = (a: number, b: number) => Math.trunc(a / b);
const mod = (a: number, b: number) => a - Math.trunc(a / b) * b;
function jalCal(jy: number) {
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
  const gy = jy + 621,
    leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150,
    march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}
function g2d(gy: number, gm: number, gd: number) {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}
function d2g(jdn: number) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1,
    gm = mod(div(i, 153), 12) + 1,
    gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}
function j2d(jy: number, jm: number, jd: number) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}
function d2j(jdn: number) {
  const g = d2g(jdn);
  let jy = g.gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(g.gy, 3, r.march);
  let k = jdn - jdn1f,
    jm: number,
    jd: number;
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
function gregorianToJalali(value: string) {
  const [gy, gm, gd] = value.split("-").map(Number);
  if (!gy || !gm || !gd) return "";
  const j = d2j(g2d(gy, gm, gd));
  return (
    j.jy +
    "/" +
    String(j.jm).padStart(2, "0") +
    "/" +
    String(j.jd).padStart(2, "0")
  );
}
function jalaliToGregorian(value: string) {
  const normalized = latinDigits(value).trim().replace(/-/g, "/");
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalized);
  if (!m) throw new Error("تاریخ را به‌صورت ۱۴۰۵/۰۶/۲۷ وارد کنید.");
  const jy = Number(m[1]),
    jm = Number(m[2]),
    jd = Number(m[3]);
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31)
    throw new Error("تاریخ شمسی معتبر نیست.");
  const jdn = j2d(jy, jm, jd),
    round = d2j(jdn);
  if (round.jy !== jy || round.jm !== jm || round.jd !== jd)
    throw new Error("تاریخ شمسی معتبر نیست.");
  const g = d2g(jdn);
  return (
    g.gy +
    "-" +
    String(g.gm).padStart(2, "0") +
    "-" +
    String(g.gd).padStart(2, "0")
  );
}

interface LineDraft {
  productId: string;
  productTitle: string;
  quantity: string;
  unitId: string;
  unitTitle: string;
  unitPrice: string;
  discountPercent: string;
  chargeAmount: string;
  description: string;
}
const emptyLine = (): LineDraft => ({
  productId: "",
  productTitle: "",
  quantity: "",
  unitId: "",
  unitTitle: "",
  unitPrice: "",
  discountPercent: "0",
  chargeAmount: "0",
  description: "",
});

function errorMessage(error: unknown): string {
  if (error instanceof PurchaseApplicationError) {
    if (error.code === "PURCHASE_APP_VERSION_CONFLICT")
      return "این سند هم‌زمان تغییر کرده است. نسخه جدید بارگذاری شد؛ دوباره عملیات را بررسی کنید.";
    if (error.code === "PURCHASE_APP_UNAUTHORIZED")
      return "برای این عملیات مجوز کافی ندارید.";
    if (error.field === "approval") return "چرخه تأیید این سند کامل نشده است.";
    return "عملیات خرید معتبر نیست؛ " + error.field;
  }
  if (error instanceof Error && error.message) return error.message;
  return "عملیات با خطا مواجه شد.";
}

export function PurchaseDocumentsPage() {
  const active = useActiveContext();
  const { session } = useAuthSession();
  const audit = useAuditServices();
  const [services, setServices] = useState<PurchaseWorkspaceServices | null>(
    null,
  );
  const [documents, setDocuments] = useState<
    readonly PurchaseDocumentSnapshot[]
  >([]);
  const [detail, setDetail] = useState<PurchaseWorkspaceDetail | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState<"cancel" | "reopen" | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [linkCompensationOpen, setLinkCompensationOpen] = useState<
    "return" | "correct" | null
  >(null);
  const [relatedDocumentId, setRelatedDocumentId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [warehouses, setWarehouses] = useState<readonly WarehouseListItemDto[]>(
    [],
  );
  const [suppliers, setSuppliers] = useState<readonly PartySelectorDto[]>([]);
  const [items, setItems] = useState<readonly ProductSelectorItemDto[]>([]);
  const [product, setProduct] = useState<ProductDto | null>(null);
  const [lineDraft, setLineDraft] = useState<LineDraft>(emptyLine());
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [newDraft, setNewDraft] = useState({
    documentType: "supplier-invoice" as PurchaseDocumentType,
    supplierId: "",
    businessDate: "",
    description: "",
    originalDocumentId: "",
    correctionReason: "",
  });

  const selected = detail?.document ?? null;
  const can = services?.can ?? (() => false);

  useEffect(() => {
    let cancelled = false;
    void getDesktopDatabase()
      .then((database) => {
        if (cancelled || !session) return;
        setServices(
          createPurchaseWorkspaceServices({
            database,
            actor: {
              id: session.user.id,
              displayName: session.user.displayName,
              permissions: session.user.permissions,
              branchIds: session.user.branchIds,
            },
            audit,
          }),
        );
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [session, audit]);

  const reload = useCallback(async () => {
    if (!services || !active.companyId || !active.branchId) return;
    setLoading(true);
    setError("");
    try {
      setDocuments(
        await services.list(active.companyId, active.branchId, search),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [services, active.companyId, active.branchId, search]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openDocument = useCallback(
    async (documentId: string) => {
      if (!services || !active.companyId) return;
      setError("");
      try {
        setDetail(await services.get(active.companyId, documentId));
      } catch (e) {
        setError(errorMessage(e));
      }
    },
    [services, active.companyId],
  );

  const openNew = async () => {
    if (!services || !active.companyId) return;
    setError("");
    setLines([]);
    setLineDraft(emptyLine());
    setNewDraft((d) => ({
      ...d,
      businessDate: gregorianToJalali(new Date().toISOString().slice(0, 10)),
      originalDocumentId: "",
      correctionReason: "",
    }));
    const [s, p] = await Promise.all([
      services.selectSuppliers(active.companyId),
      services.selectItems(active.companyId),
    ]);
    setSuppliers(s);
    setItems(p);
    setNewOpen(true);
  };

  const chooseProduct = async (productId: string) => {
    if (!services || !active.companyId) {
      return;
    }
    const selectedItem = items.find((x) => x.productId === productId);
    const value = productId
      ? await services.getItem(active.companyId, productId)
      : null;
    setProduct(value);
    const defaultUnit =
      value?.masterData.commercial.defaultPurchaseUnitId ??
      value?.units?.baseUnitId ??
      "";
    const u = value?.units?.units.find((x) => x.unitId === defaultUnit);
    setLineDraft((d) => ({
      ...d,
      productId,
      productTitle: selectedItem?.title ?? "",
      unitId: defaultUnit,
      unitTitle: u?.title ?? "",
    }));
  };

  const addLine = (event: FormEvent) => {
    event.preventDefault();
    if (
      !product ||
      !lineDraft.productId ||
      !lineDraft.quantity ||
      !lineDraft.unitId ||
      !lineDraft.unitPrice
    ) {
      return;
    }
    setLines((current) => [...current, lineDraft]);
    setLineDraft(emptyLine());
    setProduct(null);
  };

  const createDocument = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !services ||
      !active.companyId ||
      !active.branchId ||
      !active.fiscalYearId ||
      !lines.length
    )
      return;
    setSaving(true);
    setError("");
    try {
      const prepared: PurchaseWorkspaceLineInput[] = lines.map((line) => ({
        productId: line.productId,
        quantity: latinDigits(line.quantity),
        unitId: line.unitId,
        unitPrice: Number(latinDigits(line.unitPrice)),
        discountRateBasisPoints: Math.round(
          Number(latinDigits(line.discountPercent || "0")) * 100,
        ),
        chargeAmount: Number(latinDigits(line.chargeAmount || "0")),
        description: line.description.trim() || null,
      }));
      const created = await services.create({
        companyId: active.companyId,
        branchId: active.branchId,
        fiscalYearId: active.fiscalYearId,
        supplierId: newDraft.supplierId,
        documentType: newDraft.documentType,
        businessDate: jalaliToGregorian(newDraft.businessDate),
        description: newDraft.description.trim() || null,
        correctionReference: [
          "purchase-return",
          "purchase-correction",
        ].includes(newDraft.documentType)
          ? {
              documentId: newDraft.originalDocumentId,
              reason: newDraft.correctionReason.trim(),
            }
          : null,
        lines: prepared,
      });
      setNewOpen(false);
      setMessage("پیش‌نویس سند خرید ایجاد شد.");
      await reload();
      await openDocument(created.documentId);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const lifecycle = async (
    action: "submit" | "approve" | "confirm" | "cancel" | "reopen",
    actionReason?: string | null,
  ) => {
    if (!services || !selected) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (action === "submit") await services.submit(selected, actionReason);
      else if (action === "approve")
        await services.approve(selected, actionReason);
      else if (action === "confirm")
        await services.confirm(selected, actionReason);
      else if (action === "cancel")
        await services.cancel(selected, actionReason);
      else
        await services.reopen(
          selected,
          actionReason?.trim() || "بازگشایی برای اصلاح",
        );
      setReasonOpen(null);
      setReason("");
      setMessage("وضعیت سند با موفقیت به‌روزرسانی شد.");
      await reload();
      await openDocument(selected.documentId);
    } catch (e) {
      setError(errorMessage(e));
      if (
        e instanceof PurchaseApplicationError &&
        e.code === "PURCHASE_APP_VERSION_CONFLICT"
      )
        await openDocument(selected.documentId);
    } finally {
      setSaving(false);
    }
  };

  const linkCompensation = async (event: FormEvent) => {
    event.preventDefault();
    if (!services || !selected || !linkCompensationOpen || !relatedDocumentId)
      return;
    const related = documents.find(
      (item) => item.documentId === relatedDocumentId,
    );
    if (!related) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (linkCompensationOpen === "return")
        await services.returnPurchase(
          selected,
          relatedDocumentId,
          related.correctionReference?.reason ?? "برگشت خرید",
        );
      else
        await services.correct(
          selected,
          relatedDocumentId,
          related.correctionReference?.reason ?? "اصلاح خرید",
        );
      setLinkCompensationOpen(null);
      setRelatedDocumentId("");
      setMessage(
        linkCompensationOpen === "return"
          ? "برگشت خرید به سند اصلی متصل شد."
          : "اصلاح خرید به سند اصلی متصل شد.",
      );
      await reload();
      await openDocument(selected.documentId);
    } catch (e) {
      setError(errorMessage(e));
      if (
        e instanceof PurchaseApplicationError &&
        e.code === "PURCHASE_APP_VERSION_CONFLICT"
      )
        await openDocument(selected.documentId);
    } finally {
      setSaving(false);
    }
  };

  const openReceipt = async () => {
    if (!services || !selected) return;
    setWarehouses(
      await services.selectWarehouses(
        selected.companyId,
        selected.scope.branchId,
      ),
    );
    setWarehouseId("");
    setReceiptOpen(true);
  };
  const stageReceipt = async (event: FormEvent) => {
    event.preventDefault();
    if (!services || !selected || !warehouseId) return;
    setSaving(true);
    setError("");
    try {
      const result = await services.stageInventoryReceipt(
        selected,
        warehouseId,
      );
      setReceiptOpen(false);
      setMessage("پیش‌نویس رسید انبار ایجاد شد: " + result.inventoryDocumentId);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const facts = useMemo(
    () =>
      new Map(
        (detail?.commercialFacts ?? []).map((x) => [x.purchaseLineId, x]),
      ),
    [detail],
  );
  return (
    <Page>
      <div className="purchase-workspace" dir="rtl">
        <header className="purchase-workspace__toolbar">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جست‌وجو در شماره سند یا تأمین‌کننده"
          />
          <button onClick={() => void reload()} disabled={loading}>
            بازخوانی
          </button>
          {can(purchasePermissions.create) && (
            <button className="primary" onClick={() => void openNew()}>
              سند خرید جدید
            </button>
          )}
        </header>
        {error && <Feedback tone="error">{error}</Feedback>}
        {message && <Feedback tone="success">{message}</Feedback>}
        {!active.companyId || !active.branchId || !active.fiscalYearId ? (
          <Feedback tone="warning">
            شرکت، شعبه و سال مالی فعال را انتخاب کنید.
          </Feedback>
        ) : (
          <div className="purchase-workspace__grid">
            <section className="purchase-list" aria-label="فهرست اسناد خرید">
              <div className="purchase-list__header">
                <span>تاریخ</span>
                <span>سند / تأمین‌کننده</span>
                <span>وضعیت</span>
              </div>
              {documents.map((doc) => (
                <button
                  key={doc.documentId}
                  className={
                    "purchase-list__row " +
                    (selected?.documentId === doc.documentId ? "is-active" : "")
                  }
                  onClick={() => void openDocument(doc.documentId)}
                >
                  <span dir="ltr">
                    {faDate.format(new Date(doc.businessDate + "T00:00:00Z"))}
                  </span>
                  <span>
                    <strong>{doc.documentNumber ?? "بدون شماره"}</strong>
                    <small>
                      {doc.supplierSnapshot.displayName} —{" "}
                      {TYPE_LABELS[doc.documentType]}
                    </small>
                  </span>
                  <span className={"status status--" + doc.status}>
                    {STATUS_LABELS[doc.status]}
                  </span>
                </button>
              ))}
              {!documents.length && !loading && (
                <div className="empty">سند خریدی یافت نشد.</div>
              )}
            </section>
            <section className="purchase-detail">
              {!detail ? (
                <div className="empty">یک سند را برای مشاهده انتخاب کنید.</div>
              ) : (
                <>
                  <header>
                    <div>
                      <h2>
                        {TYPE_LABELS[detail.document.documentType]}{" "}
                        {detail.document.documentNumber ?? ""}
                      </h2>
                      <div className="meta">
                        <span>
                          {detail.document.supplierSnapshot.displayName}
                        </span>
                        <span dir="ltr">
                          {gregorianToJalali(detail.document.businessDate)}
                        </span>
                        <span>نسخه {detail.document.version}</span>
                      </div>
                    </div>
                    <span
                      className={"status status--" + detail.document.status}
                    >
                      {STATUS_LABELS[detail.document.status]}
                    </span>
                  </header>
                  <div className="purchase-detail__actions">
                    {selected?.status === "draft" &&
                      can(purchasePermissions.submit) && (
                        <button onClick={() => void lifecycle("submit")}>
                          ارسال برای تأیید
                        </button>
                      )}
                    {selected?.status === "submitted" &&
                      can(purchasePermissions.approve) && (
                        <button onClick={() => void lifecycle("approve")}>
                          تأیید
                        </button>
                      )}
                    {selected?.status === "approved" &&
                      can(purchasePermissions.confirm) && (
                        <button
                          className="primary"
                          onClick={() => void lifecycle("confirm")}
                        >
                          قطعی
                        </button>
                      )}
                    {selected &&
                      ["draft", "submitted", "approved"].includes(
                        selected.status,
                      ) &&
                      can(purchasePermissions.cancel) && (
                        <button
                          className="danger"
                          onClick={() => {
                            setReason("");
                            setReasonOpen("cancel");
                          }}
                        >
                          لغو
                        </button>
                      )}
                    {selected?.status === "approved" &&
                      can(purchasePermissions.reopen) && (
                        <button
                          onClick={() => {
                            setReason("");
                            setReasonOpen("reopen");
                          }}
                        >
                          بازگشت به پیش‌نویس
                        </button>
                      )}
                    {selected?.status === "confirmed" &&
                      ["purchase-order", "supplier-invoice"].includes(
                        selected.documentType,
                      ) &&
                      selected.lines.some(
                        (x) => x.lineKind === "stock-product",
                      ) &&
                      can("purchases.receipts.stage") && (
                        <button onClick={() => void openReceipt()}>
                          ایجاد پیش‌نویس رسید انبار
                        </button>
                      )}
                    {selected?.status === "confirmed" &&
                      selected.documentType === "supplier-invoice" &&
                      can(purchasePermissions.return) &&
                      documents.some(
                        (x) =>
                          x.documentType === "purchase-return" &&
                          x.status === "confirmed" &&
                          x.correctionReference?.documentId ===
                            selected.documentId,
                      ) && (
                        <button
                          onClick={() => {
                            setRelatedDocumentId("");
                            setLinkCompensationOpen("return");
                          }}
                        >
                          ثبت برگشت تأییدشده
                        </button>
                      )}
                    {selected?.status === "confirmed" &&
                      selected.documentType === "supplier-invoice" &&
                      can(purchasePermissions.correct) &&
                      documents.some(
                        (x) =>
                          x.documentType === "purchase-correction" &&
                          x.status === "confirmed" &&
                          x.correctionReference?.documentId ===
                            selected.documentId,
                      ) && (
                        <button
                          onClick={() => {
                            setRelatedDocumentId("");
                            setLinkCompensationOpen("correct");
                          }}
                        >
                          ثبت اصلاح تأییدشده
                        </button>
                      )}
                  </div>
                  <div className="purchase-summary">
                    <div>
                      <span>جمع قبل از مالیات</span>
                      <strong>
                        {money.format(detail.totals.taxBaseAmount)} ریال
                      </strong>
                    </div>
                    <div>
                      <span>مالیات</span>
                      <strong>
                        {money.format(detail.totals.taxAmount)} ریال
                      </strong>
                    </div>
                    <div>
                      <span>مبلغ نهایی</span>
                      <strong>
                        {money.format(detail.totals.grandTotal)} ریال
                      </strong>
                    </div>
                  </div>
                  <div className="purchase-lines-wrap">
                    <table className="purchase-lines">
                      <thead>
                        <tr>
                          <th>ردیف</th>
                          <th>کالا / خدمت</th>
                          <th>مقدار</th>
                          <th>قیمت واحد</th>
                          <th>تخفیف</th>
                          <th>هزینه اضافی</th>
                          <th>مالیات</th>
                          <th>مبلغ نهایی</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.document.lines.map((line) => {
                          const fact = facts.get(line.lineId);
                          const total = detail.lineTotals[line.lineId];
                          return (
                            <tr key={line.lineId}>
                              <td>{line.position}</td>
                              <td>
                                <strong>{line.itemSnapshot.displayName}</strong>
                                <small>{line.itemSnapshot.code}</small>
                              </td>
                              <td dir="ltr">
                                {fact?.commercialTerms.quantity
                                  .enteredQuantity ?? "—"}{" "}
                                {fact?.commercialTerms.quantity.enteredUnit
                                  .title ?? ""}
                              </td>
                              <td dir="ltr">
                                {fact
                                  ? money.format(
                                      fact.commercialTerms.unitPrice.amount,
                                    )
                                  : "—"}
                              </td>
                              <td>
                                {total
                                  ? money.format(total.discountAmount)
                                  : "—"}
                              </td>
                              <td>
                                {total ? money.format(total.chargeAmount) : "—"}
                              </td>
                              <td>
                                {total ? money.format(total.taxAmount) : "—"}
                              </td>
                              <td>
                                <strong>
                                  {total ? money.format(total.grandTotal) : "—"}
                                </strong>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <details className="purchase-history">
                    <summary>تاریخچه گردش</summary>
                    <ol>
                      {detail.document.lifecycleHistory.map((item, index) => (
                        <li key={index}>
                          <span dir="ltr">
                            {faDateTime.format(new Date(item.occurredAt))}
                          </span>
                          <span>
                            {STATUS_LABELS[item.fromStatus]} ←{" "}
                            {STATUS_LABELS[item.toStatus]}
                          </span>
                          <span>{item.reason ?? "—"}</span>
                        </li>
                      ))}
                    </ol>
                  </details>
                </>
              )}
            </section>
          </div>
        )}

        {newOpen && (
          <div className="purchase-modal" role="presentation">
            <div
              className="purchase-modal__sheet"
              role="dialog"
              aria-modal="true"
              aria-label="ایجاد سند خرید"
            >
              <form className="purchase-new-header" onSubmit={createDocument}>
                <h2>سند خرید جدید</h2>
                <label>
                  نوع سند
                  <select
                    value={newDraft.documentType}
                    onChange={(e) => {
                      const documentType = e.target
                        .value as PurchaseDocumentType;
                      setNewDraft((d) => ({
                        ...d,
                        documentType,
                        originalDocumentId: "",
                        correctionReason: "",
                      }));
                    }}
                  >
                    <option value="purchase-order">سفارش خرید</option>
                    <option value="supplier-invoice">فاکتور تأمین‌کننده</option>
                    <option value="purchase-return">برگشت از خرید</option>
                    <option value="purchase-correction">اصلاح خرید</option>
                  </select>
                </label>
                {["purchase-return", "purchase-correction"].includes(
                  newDraft.documentType,
                ) && (
                  <label>
                    سند اصلی
                    <select
                      required
                      value={newDraft.originalDocumentId}
                      onChange={(e) => {
                        const original = documents.find(
                          (x) => x.documentId === e.target.value,
                        );
                        setNewDraft((d) => ({
                          ...d,
                          originalDocumentId: e.target.value,
                          supplierId: original?.supplierId ?? "",
                        }));
                      }}
                    >
                      <option value="">انتخاب فاکتور قطعی…</option>
                      {documents
                        .filter(
                          (x) =>
                            x.documentType === "supplier-invoice" &&
                            x.status === "confirmed",
                        )
                        .map((x) => (
                          <option key={x.documentId} value={x.documentId}>
                            {x.documentNumber ?? x.documentId} —{" "}
                            {x.supplierSnapshot.displayName}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <label>
                  تأمین‌کننده
                  <select
                    required
                    disabled={[
                      "purchase-return",
                      "purchase-correction",
                    ].includes(newDraft.documentType)}
                    value={newDraft.supplierId}
                    onChange={(e) =>
                      setNewDraft((d) => ({ ...d, supplierId: e.target.value }))
                    }
                  >
                    <option value="">انتخاب کنید…</option>
                    {suppliers.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.code} — {x.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  تاریخ شمسی
                  <input
                    required
                    dir="ltr"
                    inputMode="numeric"
                    placeholder="1405/06/27"
                    value={newDraft.businessDate}
                    onChange={(e) =>
                      setNewDraft((d) => ({
                        ...d,
                        businessDate: e.target.value,
                      }))
                    }
                  />
                </label>
                {["purchase-return", "purchase-correction"].includes(
                  newDraft.documentType,
                ) && (
                  <label className="wide">
                    علت برگشت یا اصلاح
                    <textarea
                      required
                      value={newDraft.correctionReason}
                      onChange={(e) =>
                        setNewDraft((d) => ({
                          ...d,
                          correctionReason: e.target.value,
                        }))
                      }
                    />
                  </label>
                )}
                <label className="wide">
                  شرح
                  <input
                    value={newDraft.description}
                    onChange={(e) =>
                      setNewDraft((d) => ({
                        ...d,
                        description: e.target.value,
                      }))
                    }
                  />
                </label>
                <section className="purchase-new-lines wide">
                  <h3>ردیف‌های خرید</h3>
                  {lines.map((line, index) => (
                    <div className="purchase-draft-line" key={index}>
                      <span>{index + 1}</span>
                      <strong>{line.productTitle}</strong>
                      <span dir="ltr">
                        {line.quantity} {line.unitTitle}
                      </span>
                      <span>
                        {money.format(Number(line.unitPrice || 0))} ریال
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setLines((current) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                      >
                        حذف
                      </button>
                    </div>
                  ))}
                  {!lines.length && (
                    <p className="empty">حداقل یک ردیف اضافه کنید.</p>
                  )}
                </section>
                <footer className="wide">
                  <button type="button" onClick={() => setNewOpen(false)}>
                    انصراف
                  </button>
                  <button
                    className="primary"
                    disabled={
                      saving ||
                      !lines.length ||
                      !newDraft.supplierId ||
                      (["purchase-return", "purchase-correction"].includes(
                        newDraft.documentType,
                      ) &&
                        (!newDraft.originalDocumentId ||
                          !newDraft.correctionReason.trim()))
                    }
                  >
                    ایجاد پیش‌نویس
                  </button>
                </footer>
              </form>
              <form className="purchase-line-form" onSubmit={addLine}>
                <h3>افزودن ردیف</h3>
                <label>
                  کالا / خدمت
                  <select
                    required
                    value={lineDraft.productId}
                    onChange={(e) => void chooseProduct(e.target.value)}
                  >
                    <option value="">انتخاب کنید…</option>
                    {items.map((x) => (
                      <option key={x.productId} value={x.productId}>
                        {x.code} — {x.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  مقدار
                  <input
                    required
                    dir="ltr"
                    inputMode="decimal"
                    value={lineDraft.quantity}
                    onChange={(e) =>
                      setLineDraft((d) => ({ ...d, quantity: e.target.value }))
                    }
                  />
                </label>
                <label>
                  واحد
                  <select
                    required
                    disabled={!product?.units}
                    value={lineDraft.unitId}
                    onChange={(e) => {
                      const u = product?.units?.units.find(
                        (x) => x.unitId === e.target.value,
                      );
                      setLineDraft((d) => ({
                        ...d,
                        unitId: e.target.value,
                        unitTitle: u?.title ?? "",
                      }));
                    }}
                  >
                    <option value="">انتخاب کنید…</option>
                    {product?.units?.units.map((u) => (
                      <option key={u.unitId} value={u.unitId}>
                        {u.title} ({u.code})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  قیمت واحد (ریال)
                  <input
                    required
                    dir="ltr"
                    inputMode="decimal"
                    value={lineDraft.unitPrice}
                    onChange={(e) =>
                      setLineDraft((d) => ({ ...d, unitPrice: e.target.value }))
                    }
                  />
                </label>
                <label>
                  تخفیف (درصد)
                  <input
                    dir="ltr"
                    inputMode="decimal"
                    value={lineDraft.discountPercent}
                    onChange={(e) =>
                      setLineDraft((d) => ({
                        ...d,
                        discountPercent: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  هزینه اضافی (ریال)
                  <input
                    dir="ltr"
                    inputMode="decimal"
                    value={lineDraft.chargeAmount}
                    onChange={(e) =>
                      setLineDraft((d) => ({
                        ...d,
                        chargeAmount: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  مالیات
                  <input
                    readOnly
                    value={
                      product?.masterData.tax.treatment === "taxable"
                        ? (product.masterData.tax.vatRateBasisPoints ?? 0) /
                            100 +
                          "٪"
                        : "معاف / مشمول نیست"
                    }
                  />
                </label>
                <label className="wide">
                  شرح ردیف
                  <input
                    value={lineDraft.description}
                    onChange={(e) =>
                      setLineDraft((d) => ({
                        ...d,
                        description: e.target.value,
                      }))
                    }
                  />
                </label>
                <footer className="wide">
                  <button type="submit" disabled={!product}>
                    افزودن ردیف
                  </button>
                </footer>
              </form>
            </div>
          </div>
        )}

        {reasonOpen && selected && (
          <div className="purchase-modal" role="presentation">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void lifecycle(reasonOpen, reason);
              }}
              role="dialog"
              aria-modal="true"
            >
              <h2>
                {reasonOpen === "cancel"
                  ? "لغو سند خرید"
                  : "بازگشت به پیش‌نویس"}
              </h2>
              <label>
                علت
                <textarea
                  required
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <footer>
                <button type="button" onClick={() => setReasonOpen(null)}>
                  انصراف
                </button>
                <button
                  className={reasonOpen === "cancel" ? "danger" : "primary"}
                  disabled={saving || !reason.trim()}
                >
                  تأیید
                </button>
              </footer>
            </form>
          </div>
        )}

        {linkCompensationOpen && selected && (
          <div className="purchase-modal" role="presentation">
            <form onSubmit={linkCompensation} role="dialog" aria-modal="true">
              <h2>
                {linkCompensationOpen === "return"
                  ? "اتصال برگشت خرید"
                  : "اتصال اصلاح خرید"}
              </h2>
              <p>
                فقط سند جبرانی قطعی که به همین فاکتور اصلی ارجاع دارد قابل
                انتخاب است.
              </p>
              <label>
                سند جبرانی
                <select
                  required
                  value={relatedDocumentId}
                  onChange={(e) => setRelatedDocumentId(e.target.value)}
                >
                  <option value="">انتخاب کنید…</option>
                  {documents
                    .filter(
                      (x) =>
                        x.documentType ===
                          (linkCompensationOpen === "return"
                            ? "purchase-return"
                            : "purchase-correction") &&
                        x.status === "confirmed" &&
                        x.correctionReference?.documentId ===
                          selected.documentId,
                    )
                    .map((x) => (
                      <option key={x.documentId} value={x.documentId}>
                        {x.documentNumber ?? x.documentId}
                      </option>
                    ))}
                </select>
              </label>
              <footer>
                <button
                  type="button"
                  onClick={() => setLinkCompensationOpen(null)}
                >
                  انصراف
                </button>
                <button
                  className="primary"
                  disabled={saving || !relatedDocumentId}
                >
                  ثبت ارتباط
                </button>
              </footer>
            </form>
          </div>
        )}

        {receiptOpen && selected && (
          <div className="purchase-modal" role="presentation">
            <form onSubmit={stageReceipt} role="dialog" aria-modal="true">
              <h2>ایجاد پیش‌نویس رسید انبار</h2>
              <p>
                تمام ردیف‌های کالای انباری این سند با مقدار پایه در یک رسید
                پیش‌نویس قرار می‌گیرند.
              </p>
              <label>
                انبار مقصد
                <select
                  required
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                >
                  <option value="">انتخاب کنید…</option>
                  {warehouses.map((x) => (
                    <option key={x.warehouseId} value={x.warehouseId}>
                      {x.code} — {x.title}
                    </option>
                  ))}
                </select>
              </label>
              <footer>
                <button type="button" onClick={() => setReceiptOpen(false)}>
                  انصراف
                </button>
                <button className="primary" disabled={saving || !warehouseId}>
                  ایجاد پیش‌نویس رسید انبار
                </button>
              </footer>
            </form>
          </div>
        )}
      </div>
    </Page>
  );
}
