import {
  type FormEvent,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  PRODUCT_APPLICATION_ERROR_CODES,
  ProductApplicationError,
  ProductService,
  SecuredProductReader,
  SecuredProductService,
  productPermissions,
  type ProductAuthorizationPolicy,
  type ProductDto,
  type ProductKind,
  type ProductListItemDto,
  type ProductTaxTreatment,
} from "@argin/product";
import {
  SqliteProductDuplicateDetector,
  SqliteProductIdempotencyExecutor,
  SqliteProductReader,
  SqliteProductUnitOfWork,
  SqliteTaxpayerUnitReferenceValidator,
} from "@argin/product-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";

import { useActiveContext } from "../../app/providers/active-context-provider";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { Feedback } from "../../components/feedback";
import { Page } from "../../components/layout";
import { createPersistentProductAuditSink } from "./product-audit-sink";
import { getProductErrorMessage } from "./product-error-presenter";

import "./products-page.css";

type KindFilter = "all" | ProductKind;
type StatusFilter = "all" | "active" | "inactive";

interface Draft {
  kind: ProductKind;
  code: string;
  title: string;
  categoryId: string;
  purchasable: boolean;
  sellable: boolean;
  sku: string;
  referenceCode: string;
  barcode: string;
  taxpayerGoodsServiceId: string;
  brand: string;
  model: string;
  purchaseDescription: string;
  salesDescription: string;
  taxTreatment: ProductTaxTreatment;
  vatRatePercent: string;
  stockTracking: boolean;
  serialTracking: boolean;
  lotTracking: boolean;
  shelfLifeDays: string;
  baseUnitId: string;
  baseUnitCode: string;
  baseUnitTitle: string;
  baseUnitPrecision: string;
  taxpayerUnitCode: string;
}

const emptyDraft: Draft = {
  kind: "product",
  code: "",
  title: "",
  categoryId: "",
  purchasable: true,
  sellable: true,
  sku: "",
  referenceCode: "",
  barcode: "",
  taxpayerGoodsServiceId: "",
  brand: "",
  model: "",
  purchaseDescription: "",
  salesDescription: "",
  taxTreatment: "unspecified",
  vatRatePercent: "",
  stockTracking: false,
  serialTracking: false,
  lotTracking: false,
  shelfLifeDays: "",
  baseUnitId: "",
  baseUnitCode: "",
  baseUnitTitle: "",
  baseUnitPrecision: "0",
  taxpayerUnitCode: "",
};

const persianDateTimeFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatPersianDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : persianDateTimeFormatter.format(date);
}

function kindLabel(kind: ProductKind): string {
  return kind === "product" ? "کالا" : "خدمت";
}

function createContext(companyId: string, actorId: string) {
  const requestId = crypto.randomUUID();
  return {
    companyId,
    actorId,
    requestId,
    correlationId: requestId,
    occurredAt: new Date().toISOString(),
  } as const;
}

function nullable(value: string): string | null {
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function draftFromDetail(detail: ProductDto): Draft {
  const base = detail.units?.units.find((unit) => unit.unitId === detail.units?.baseUnitId);
  return {
    kind: detail.kind,
    code: detail.code,
    title: detail.title,
    categoryId: detail.categoryId ?? "",
    purchasable: detail.capabilities.purchasable,
    sellable: detail.capabilities.sellable,
    sku: detail.identifiers.sku ?? "",
    referenceCode: detail.identifiers.referenceCode ?? "",
    barcode: detail.identifiers.barcodes[0] ?? "",
    taxpayerGoodsServiceId: detail.identifiers.taxpayerGoodsServiceId ?? "",
    brand: detail.masterData.commercial.brand ?? "",
    model: detail.masterData.commercial.model ?? "",
    purchaseDescription: detail.masterData.commercial.purchaseDescription ?? "",
    salesDescription: detail.masterData.commercial.salesDescription ?? "",
    taxTreatment: detail.masterData.tax.treatment,
    vatRatePercent:
      detail.masterData.tax.vatRateBasisPoints === null
        ? ""
        : String(detail.masterData.tax.vatRateBasisPoints / 100),
    stockTracking: detail.masterData.operational.stockTracking,
    serialTracking: detail.masterData.operational.serialTracking,
    lotTracking: detail.masterData.operational.lotTracking,
    shelfLifeDays:
      detail.masterData.operational.shelfLifeDays === null
        ? ""
        : String(detail.masterData.operational.shelfLifeDays),
    baseUnitId: base?.unitId ?? "",
    baseUnitCode: base?.code ?? "",
    baseUnitTitle: base?.title ?? "",
    baseUnitPrecision: base ? String(base.precision) : "0",
    taxpayerUnitCode: base?.taxpayerUnitCode ?? "",
  };
}

function identifiersFromDraft(draft: Draft) {
  return {
    sku: nullable(draft.sku),
    referenceCode: nullable(draft.referenceCode),
    barcodes: draft.barcode.trim() ? [draft.barcode] : [],
    taxpayerGoodsServiceId: nullable(draft.taxpayerGoodsServiceId),
    externalIdentifiers: [],
  } as const;
}

function unitsFromDraft(draft: Draft) {
  if (!draft.baseUnitId.trim() && !draft.baseUnitCode.trim() && !draft.baseUnitTitle.trim()) {
    return null;
  }
  return {
    baseUnit: {
      unitId: draft.baseUnitId,
      code: draft.baseUnitCode,
      title: draft.baseUnitTitle,
      precision: Number(draft.baseUnitPrecision),
      roundingMode: "half-up" as const,
      taxpayerUnitCode: nullable(draft.taxpayerUnitCode),
    },
    alternateUnits: [],
  } as const;
}

function masterDataFromDraft(draft: Draft) {
  const taxable = draft.taxTreatment === "taxable";
  return {
    commercial: {
      brand: nullable(draft.brand),
      model: nullable(draft.model),
      purchaseDescription: nullable(draft.purchaseDescription),
      salesDescription: nullable(draft.salesDescription),
      defaultPurchaseUnitId: null,
      defaultSalesUnitId: null,
    },
    tax: {
      treatment: draft.taxTreatment,
      vatRateBasisPoints: taxable && draft.vatRatePercent.trim()
        ? Math.round(Number(draft.vatRatePercent) * 100)
        : null,
    },
    operational: {
      stockTracking: draft.kind === "product" && draft.stockTracking,
      serialTracking: draft.kind === "product" && draft.serialTracking,
      lotTracking: draft.kind === "product" && draft.lotTracking,
      shelfLifeDays:
        draft.kind === "product" && draft.shelfLifeDays.trim()
          ? Number(draft.shelfLifeDays)
          : null,
    },
  } as const;
}

export function ProductsPage() {
  const { session } = useAuthSession();
  const active = useActiveContext();
  const [items, setItems] = useState<readonly ProductListItemDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProductDto | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [kind, setKind] = useState<KindFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const permissionSet = useMemo(
    () => new Set(session?.user.permissions ?? []),
    [session],
  );
  const can = useCallback(
    (permission: string) =>
      permissionSet.has("system.full-access") || permissionSet.has(permission),
    [permissionSet],
  );
  const actorId = session?.user.id ?? "desktop-local-user";

  const authorization = useMemo<ProductAuthorizationPolicy>(
    () => ({
      require: async (_context, permission) => {
        if (!can(permission)) {
          throw new ProductApplicationError(PRODUCT_APPLICATION_ERROR_CODES.unauthorized);
        }
      },
    }),
    [can],
  );

  const buildAdapters = useCallback(async () => {
    const database = await getDesktopDatabase();
    const reader = new SqliteProductReader(database);
    const duplicateDetector = new SqliteProductDuplicateDetector(database);
    const service = new ProductService({
      unitOfWork: new SqliteProductUnitOfWork(database),
      reader,
      duplicateDetector,
      idempotency: new SqliteProductIdempotencyExecutor(database),
      taxpayerUnitReferences: new SqliteTaxpayerUnitReferenceValidator(database),
    });
    return {
      reader: new SecuredProductReader(reader, authorization, {
        actorId,
        correlationId: crypto.randomUUID(),
        requestId: crypto.randomUUID(),
      }),
      service: new SecuredProductService(
        service,
        authorization,
        createPersistentProductAuditSink(database),
      ),
    };
  }, [actorId, authorization]);

  const loadDetail = useCallback(async (productId: string | null) => {
    if (!productId || !active.companyId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    try {
      const { reader } = await buildAdapters();
      setDetail(await reader.getById({ companyId: active.companyId, productId }));
    } catch (reason) {
      setError(getProductErrorMessage(reason));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [active.companyId, buildAdapters]);

  const reload = useCallback(async () => {
    if (!active.companyId || !can(productPermissions.view)) {
      setItems([]);
      setTotalItems(0);
      setTotalPages(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { reader } = await buildAdapters();
      const result = await reader.list({
        filter: {
          companyId: active.companyId,
          ...(deferredSearch.trim() ? { search: deferredSearch.trim() } : {}),
          ...(kind === "all" ? {} : { kinds: [kind] }),
          ...(status === "all" ? {} : { statuses: [status] }),
        },
        page: { page, pageSize: 40 },
        sort: { field: "title", direction: "asc" },
      });
      setItems(result.items);
      setTotalItems(result.totalItems);
      setTotalPages(result.totalPages);
      if (page > result.totalPages && result.totalPages > 0) setPage(result.totalPages);
    } catch (reason) {
      setError(getProductErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [active.companyId, buildAdapters, can, deferredSearch, kind, page, status]);

  useEffect(() => {
    setSelectedId(null);
    setDetail(null);
    setPage(1);
  }, [active.companyId]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { void loadDetail(selectedId); }, [loadDetail, selectedId]);

  useEffect(() => {
    if (!formOpen) return undefined;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setFormOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [formOpen, saving]);

  function clearFeedback() {
    setError("");
    setMessage("");
  }

  function startCreate() {
    setSelectedId(null);
    setDetail(null);
    setDraft(emptyDraft);
    clearFeedback();
    setFormOpen(true);
  }

  function startEdit() {
    if (!detail) return;
    setDraft(draftFromDetail(detail));
    clearFeedback();
    setFormOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active.companyId) return;
    setSaving(true);
    clearFeedback();
    try {
      const { service } = await buildAdapters();
      if (!detail) {
        const created = await service.create({
          context: createContext(active.companyId, actorId),
          productId: crypto.randomUUID(),
          code: draft.code,
          title: draft.title,
          kind: draft.kind,
          categoryId: nullable(draft.categoryId),
          capabilities: { purchasable: draft.purchasable, sellable: draft.sellable },
          identifiers: identifiersFromDraft(draft),
          units: unitsFromDraft(draft),
          masterData: masterDataFromDraft(draft),
        });
        setSelectedId(created.productId);
        setMessage(`${kindLabel(created.kind)} با موفقیت ثبت شد.`);
      } else {
        let current = detail;
        current = await service.updateIdentity({
          context: createContext(active.companyId, actorId),
          productId: current.productId,
          expectedVersion: current.version,
          code: draft.code,
          title: draft.title,
          categoryId: nullable(draft.categoryId),
          capabilities: { purchasable: draft.purchasable, sellable: draft.sellable },
        });
        current = await service.replaceIdentifiers({
          context: createContext(active.companyId, actorId),
          productId: current.productId,
          expectedVersion: current.version,
          identifiers: identifiersFromDraft(draft),
        });
        current = await service.replaceUnits({
          context: createContext(active.companyId, actorId),
          productId: current.productId,
          expectedVersion: current.version,
          units: unitsFromDraft(draft),
        });
        current = await service.replaceMasterData({
          context: createContext(active.companyId, actorId),
          productId: current.productId,
          expectedVersion: current.version,
          masterData: masterDataFromDraft(draft),
        });
        setDetail(current);
        setMessage("تغییرات کالا/خدمت ذخیره شد.");
      }
      setFormOpen(false);
      await reload();
      if (selectedId) await loadDetail(selectedId);
    } catch (reason) {
      setError(getProductErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    if (!detail || !active.companyId) return;
    setSaving(true);
    clearFeedback();
    try {
      const { service } = await buildAdapters();
      const result = await service.setStatus({
        context: createContext(active.companyId, actorId),
        productId: detail.productId,
        expectedVersion: detail.version,
        active: detail.status !== "active",
      });
      setDetail(result);
      setMessage(result.status === "active" ? "رکورد فعال شد." : "رکورد غیرفعال شد.");
      await reload();
    } catch (reason) {
      setError(getProductErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  if (!can(productPermissions.view)) {
    return <Page className="products-page" lang="fa" dir="rtl"><Feedback tone="error">شما مجوز مشاهده کالاها و خدمات را ندارید.</Feedback></Page>;
  }

  return (
    <Page className="products-page" lang="fa" dir="rtl">
      <header className="products-page__header">
        <div>
          <p className="products-page__eyebrow">اطلاعات پایه / کالا و خدمات</p>
          <h1>کالاها و خدمات</h1>
          <p>تعریف و نگهداری مشخصات پایه، شناسه‌ها، واحد، مالیات و قابلیت‌های عملیاتی</p>
        </div>
        <button className="product-button product-button--primary" type="button" onClick={startCreate} disabled={!active.companyId || !can(productPermissions.create)}>کالا / خدمت جدید</button>
      </header>

      {!active.companyId && <Feedback tone="warning">برای مدیریت کالا و خدمات ابتدا شرکت فعال را انتخاب کنید.</Feedback>}
      {error && <Feedback tone="error">{error}</Feedback>}
      {message && <Feedback tone="success">{message}</Feedback>}

      <section className="product-toolbar" aria-label="جستجو و فیلتر کالا و خدمات">
        <label className="product-search"><span>جستجو</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="کد، عنوان یا شناسه..." /></label>
        <label><span>نوع</span><select value={kind} onChange={(event) => { setKind(event.target.value as KindFilter); setPage(1); }}><option value="all">همه</option><option value="product">کالا</option><option value="service">خدمت</option></select></label>
        <label><span>وضعیت</span><select value={status} onChange={(event) => { setStatus(event.target.value as StatusFilter); setPage(1); }}><option value="all">همه</option><option value="active">فعال</option><option value="inactive">غیرفعال</option></select></label>
        <button className="product-button" type="button" onClick={() => void reload()} disabled={loading}>تازه‌سازی</button>
      </section>

      <div className="products-layout">
        <section className="product-list-panel" aria-busy={loading}>
          {loading ? <div className="product-state" role="status">در حال دریافت اطلاعات…</div> : items.length === 0 ? <div className="product-state"><strong>رکوردی یافت نشد.</strong><span>فیلترها را تغییر دهید یا رکورد جدید بسازید.</span></div> : (
            <div className="product-table-wrap"><table className="product-table"><caption className="sr-only">فهرست کالاها و خدمات شرکت فعال</caption><thead><tr><th>کد</th><th>عنوان</th><th>نوع</th><th>SKU</th><th>خرید</th><th>فروش</th><th>وضعیت</th></tr></thead><tbody>{items.map((item) => (
              <tr key={item.productId} tabIndex={0} aria-selected={selectedId === item.productId} className={selectedId === item.productId ? "product-table__row--selected" : ""} onClick={() => setSelectedId(item.productId)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(item.productId); } }}>
                <td>{item.code}</td><td><strong>{item.title}</strong></td><td>{kindLabel(item.kind)}</td><td dir="ltr">{item.sku ?? "—"}</td><td>{item.purchasable ? "بله" : "خیر"}</td><td>{item.sellable ? "بله" : "خیر"}</td><td><span className={`product-status product-status--${item.status}`}>{item.status === "active" ? "فعال" : "غیرفعال"}</span></td>
              </tr>
            ))}</tbody></table></div>
          )}
          <footer className="product-pagination"><span>{totalItems.toLocaleString("fa-IR")} رکورد</span><div><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>قبلی</button><span>صفحه {page.toLocaleString("fa-IR")} از {Math.max(1, totalPages).toLocaleString("fa-IR")}</span><button type="button" onClick={() => setPage((value) => value + 1)} disabled={page >= totalPages}>بعدی</button></div></footer>
        </section>

        <aside className="product-detail-panel" aria-busy={detailLoading}>
          {detailLoading ? <div className="product-state" role="status">در حال دریافت جزئیات…</div> : !detail ? <div className="product-state"><strong>یک رکورد را انتخاب کنید.</strong><span>جزئیات کالا یا خدمت در این بخش نمایش داده می‌شود.</span></div> : (
            <>
              <div className="product-detail__heading"><div><span>{kindLabel(detail.kind)}</span><h2>{detail.title}</h2><code dir="ltr">{detail.code}</code></div><span className={`product-status product-status--${detail.status}`}>{detail.status === "active" ? "فعال" : "غیرفعال"}</span></div>
              <dl className="product-kv"><div><dt>شناسه پایدار</dt><dd dir="ltr">{detail.productId}</dd></div><div><dt>SKU</dt><dd dir="ltr">{detail.identifiers.sku ?? "—"}</dd></div><div><dt>شناسه مودیان</dt><dd dir="ltr">{detail.identifiers.taxpayerGoodsServiceId ?? "—"}</dd></div><div><dt>بارکد</dt><dd dir="ltr">{detail.identifiers.barcodes[0] ?? "—"}</dd></div><div><dt>برند / مدل</dt><dd>{[detail.masterData.commercial.brand, detail.masterData.commercial.model].filter(Boolean).join(" / ") || "—"}</dd></div><div><dt>مالیات</dt><dd>{detail.masterData.tax.treatment === "taxable" ? `${((detail.masterData.tax.vatRateBasisPoints ?? 0) / 100).toLocaleString("fa-IR")}%` : detail.masterData.tax.treatment}</dd></div><div><dt>واحد پایه</dt><dd>{detail.units?.units.find((unit) => unit.unitId === detail.units?.baseUnitId)?.title ?? "—"}</dd></div><div><dt>آخرین تغییر</dt><dd>{formatPersianDateTime(detail.updatedAt)}</dd></div></dl>
              <div className="product-detail__flags"><span>{detail.capabilities.purchasable ? "قابل خرید" : "غیرقابل خرید"}</span><span>{detail.capabilities.sellable ? "قابل فروش" : "غیرقابل فروش"}</span>{detail.masterData.operational.stockTracking && <span>ردیابی موجودی</span>}{detail.masterData.operational.serialTracking && <span>سریال</span>}{detail.masterData.operational.lotTracking && <span>بچ</span>}</div>
              <div className="product-detail__actions"><button className="product-button product-button--primary" type="button" onClick={startEdit} disabled={!can(productPermissions.update)}>ویرایش</button><button className="product-button" type="button" onClick={() => void toggleStatus()} disabled={saving || !can(productPermissions.changeStatus)}>{detail.status === "active" ? "غیرفعال کردن" : "فعال کردن"}</button></div>
            </>
          )}
        </aside>
      </div>

      {formOpen && (
        <div className="product-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !saving) setFormOpen(false); }}>
          <section className="product-dialog" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
            <form onSubmit={(event) => void submit(event)}>
              <header><div><p>اطلاعات پایه</p><h2 id="product-form-title">{detail ? "ویرایش کالا / خدمت" : "کالا / خدمت جدید"}</h2></div><button type="button" className="product-dialog__close" aria-label="بستن" onClick={() => setFormOpen(false)} disabled={saving}>×</button></header>
              <div className="product-form-scroll">
                <fieldset><legend>هویت و طبقه‌بندی</legend><div className="product-form-grid"><label><span>نوع</span><select value={draft.kind} disabled={Boolean(detail)} onChange={(event) => setDraft((value) => ({ ...value, kind: event.target.value as ProductKind }))}><option value="product">کالا</option><option value="service">خدمت</option></select></label><label><span>کد *</span><input autoFocus value={draft.code} onChange={(event) => setDraft((value) => ({ ...value, code: event.target.value }))} /></label><label className="product-form-grid__wide"><span>عنوان *</span><input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} /></label><label><span>شناسه گروه</span><input value={draft.categoryId} onChange={(event) => setDraft((value) => ({ ...value, categoryId: event.target.value }))} /></label><label className="product-check"><input type="checkbox" checked={draft.purchasable} onChange={(event) => setDraft((value) => ({ ...value, purchasable: event.target.checked }))} /><span>قابل خرید</span></label><label className="product-check"><input type="checkbox" checked={draft.sellable} onChange={(event) => setDraft((value) => ({ ...value, sellable: event.target.checked }))} /><span>قابل فروش</span></label></div></fieldset>
                <fieldset><legend>شناسه‌ها</legend><div className="product-form-grid"><label><span>SKU</span><input dir="ltr" value={draft.sku} onChange={(event) => setDraft((value) => ({ ...value, sku: event.target.value }))} /></label><label><span>کد مرجع</span><input dir="ltr" value={draft.referenceCode} onChange={(event) => setDraft((value) => ({ ...value, referenceCode: event.target.value }))} /></label><label><span>بارکد اصلی</span><input dir="ltr" value={draft.barcode} onChange={(event) => setDraft((value) => ({ ...value, barcode: event.target.value }))} /></label><label><span>شناسه ۱۳ رقمی مودیان</span><input dir="ltr" inputMode="numeric" maxLength={13} value={draft.taxpayerGoodsServiceId} onChange={(event) => setDraft((value) => ({ ...value, taxpayerGoodsServiceId: event.target.value }))} /></label></div></fieldset>
                <fieldset><legend>واحد پایه</legend><div className="product-form-grid"><label><span>شناسه واحد</span><input dir="ltr" value={draft.baseUnitId} onChange={(event) => setDraft((value) => ({ ...value, baseUnitId: event.target.value }))} /></label><label><span>کد داخلی واحد</span><input dir="ltr" value={draft.baseUnitCode} onChange={(event) => setDraft((value) => ({ ...value, baseUnitCode: event.target.value }))} /></label><label><span>عنوان واحد</span><input value={draft.baseUnitTitle} onChange={(event) => setDraft((value) => ({ ...value, baseUnitTitle: event.target.value }))} /></label><label><span>دقت اعشار</span><input type="number" min="0" max="6" value={draft.baseUnitPrecision} onChange={(event) => setDraft((value) => ({ ...value, baseUnitPrecision: event.target.value }))} /></label><label><span>کد واحد مودیان</span><input dir="ltr" value={draft.taxpayerUnitCode} onChange={(event) => setDraft((value) => ({ ...value, taxpayerUnitCode: event.target.value }))} /></label></div></fieldset>
                <fieldset><legend>تجاری و مالیاتی</legend><div className="product-form-grid"><label><span>برند</span><input value={draft.brand} onChange={(event) => setDraft((value) => ({ ...value, brand: event.target.value }))} /></label><label><span>مدل</span><input value={draft.model} onChange={(event) => setDraft((value) => ({ ...value, model: event.target.value }))} /></label><label className="product-form-grid__wide"><span>شرح خرید</span><input value={draft.purchaseDescription} onChange={(event) => setDraft((value) => ({ ...value, purchaseDescription: event.target.value }))} /></label><label className="product-form-grid__wide"><span>شرح فروش</span><input value={draft.salesDescription} onChange={(event) => setDraft((value) => ({ ...value, salesDescription: event.target.value }))} /></label><label><span>وضعیت مالیاتی</span><select value={draft.taxTreatment} onChange={(event) => setDraft((value) => ({ ...value, taxTreatment: event.target.value as ProductTaxTreatment }))}><option value="unspecified">تعیین نشده</option><option value="taxable">مشمول</option><option value="exempt">معاف</option><option value="not-subject">خارج از شمول</option></select></label><label><span>نرخ ارزش افزوده (%)</span><input type="number" min="0" max="100" step="0.01" disabled={draft.taxTreatment !== "taxable"} value={draft.vatRatePercent} onChange={(event) => setDraft((value) => ({ ...value, vatRatePercent: event.target.value }))} /></label></div></fieldset>
                <fieldset disabled={draft.kind === "service"}><legend>تنظیمات عملیاتی کالا</legend><div className="product-form-grid product-form-grid--checks"><label className="product-check"><input type="checkbox" checked={draft.stockTracking} onChange={(event) => setDraft((value) => ({ ...value, stockTracking: event.target.checked, ...(event.target.checked ? {} : { serialTracking: false, lotTracking: false, shelfLifeDays: "" }) }))} /><span>ردیابی موجودی</span></label><label className="product-check"><input type="checkbox" checked={draft.serialTracking} disabled={!draft.stockTracking} onChange={(event) => setDraft((value) => ({ ...value, serialTracking: event.target.checked }))} /><span>ردیابی سریال</span></label><label className="product-check"><input type="checkbox" checked={draft.lotTracking} disabled={!draft.stockTracking} onChange={(event) => setDraft((value) => ({ ...value, lotTracking: event.target.checked }))} /><span>ردیابی بچ</span></label><label><span>عمر نگهداری (روز)</span><input type="number" min="1" disabled={!draft.stockTracking} value={draft.shelfLifeDays} onChange={(event) => setDraft((value) => ({ ...value, shelfLifeDays: event.target.value }))} /></label></div></fieldset>
              </div>
              <footer><span>اعتبارسنجی نهایی توسط Domain و Application انجام می‌شود.</span><div><button className="product-button" type="button" onClick={() => setFormOpen(false)} disabled={saving}>انصراف</button><button className="product-button product-button--primary" type="submit" disabled={saving}>{saving ? "در حال ذخیره…" : "ذخیره"}</button></div></footer>
            </form>
          </section>
        </div>
      )}
    </Page>
  );
}
