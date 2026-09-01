import {
  type FormEvent,
  type ReactNode,
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
import {
  loadTaxpayerUnitOptions,
  type TaxpayerUnitOption,
} from "./taxpayer-unit-options";

import "./products-page.css";
import "./products-page-validation.css";

type KindFilter = "all" | ProductKind;
type StatusFilter = "all" | "active" | "inactive";
type FieldKey =
  | "code"
  | "title"
  | "categoryId"
  | "sku"
  | "referenceCode"
  | "barcode"
  | "taxpayerGoodsServiceId"
  | "unit"
  | "baseUnitPrecision"
  | "brand"
  | "model"
  | "purchaseDescription"
  | "salesDescription"
  | "taxTreatment"
  | "vatRatePercent"
  | "stockTracking"
  | "serialTracking"
  | "lotTracking"
  | "shelfLifeDays";

type FieldErrors = Partial<Record<FieldKey, string>>;

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

function HelpLabel({ children, help }: { children: ReactNode; help: string }) {
  return (
    <span className="product-label-text">
      <span>{children}</span>
      <button
        className="product-help"
        type="button"
        data-help={help}
        aria-label={`راهنما: ${typeof children === "string" ? children : "فیلد"}`}
      >
        ؟
      </button>
    </span>
  );
}

function fieldClass(errors: FieldErrors, key: FieldKey): string | undefined {
  return errors[key] ? "product-field--invalid" : undefined;
}

function FieldError({ errors, name }: { errors: FieldErrors; name: FieldKey }) {
  return errors[name] ? <span className="product-field-error">{errors[name]}</span> : null;
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
  if (!draft.baseUnitId.trim()) return null;
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
      vatRateBasisPoints:
        taxable && draft.vatRatePercent.trim()
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

function validateDraft(draft: Draft): FieldErrors {
  const errors: FieldErrors = {};
  if (!draft.code.trim()) errors.code = "کد کالا/خدمت الزامی است.";
  if (!draft.title.trim()) errors.title = "عنوان کالا/خدمت الزامی است.";
  if (draft.taxpayerGoodsServiceId.trim() && !/^\d{13}$/u.test(draft.taxpayerGoodsServiceId.trim())) {
    errors.taxpayerGoodsServiceId = "شناسه سامانه مودیان باید دقیقاً ۱۳ رقم باشد.";
  }
  if (draft.baseUnitId.trim()) {
    const precision = Number(draft.baseUnitPrecision);
    if (!Number.isInteger(precision) || precision < 0 || precision > 6) {
      errors.baseUnitPrecision = "دقت اعشار باید یک عدد صحیح بین صفر تا ۶ باشد.";
    }
  }
  if (draft.taxTreatment === "taxable") {
    const vat = Number(draft.vatRatePercent);
    if (!draft.vatRatePercent.trim() || !Number.isFinite(vat) || vat < 0 || vat > 100) {
      errors.vatRatePercent = "برای رکورد مشمول، نرخ ارزش افزوده بین صفر تا ۱۰۰ وارد کنید.";
    }
  }
  if (draft.kind === "product" && (draft.serialTracking || draft.lotTracking || draft.shelfLifeDays.trim()) && !draft.stockTracking) {
    errors.stockTracking = "برای سریال، بچ یا عمر نگهداری باید ردیابی موجودی فعال باشد.";
  }
  if (draft.shelfLifeDays.trim()) {
    const days = Number(draft.shelfLifeDays);
    if (!Number.isInteger(days) || days <= 0) errors.shelfLifeDays = "عمر نگهداری باید تعداد روز صحیح و مثبت باشد.";
  }
  return errors;
}

function mapErrorToFields(reason: unknown): FieldErrors {
  const code = typeof reason === "object" && reason !== null && "code" in reason
    ? String((reason as { code?: unknown }).code ?? "")
    : "";
  const message = getProductErrorMessage(reason);
  const map: Record<string, FieldKey[]> = {
    "product.code.required": ["code"],
    "product.application.code-conflict": ["code"],
    "product.title.required": ["title"],
    "product.taxpayer-goods-service-id.invalid": ["taxpayerGoodsServiceId"],
    "product.unit.invalid": ["unit"],
    "product.unit.taxpayer-code.invalid": ["unit"],
    "product.application.taxpayer-unit-reference-invalid": ["unit"],
    "product.unit.precision.invalid": ["baseUnitPrecision"],
    "product.vat-rate.invalid": ["vatRatePercent"],
    "product.tax-treatment.invalid": ["taxTreatment"],
    "product.service-stock-tracking.invalid": ["stockTracking", "serialTracking", "lotTracking", "shelfLifeDays"],
    "product.operational-attribute.invalid": ["stockTracking", "serialTracking", "lotTracking", "shelfLifeDays"],
    "product.commercial-attribute.invalid": ["brand", "model", "purchaseDescription", "salesDescription"],
    "product.application.duplicate-identifier": ["sku", "referenceCode", "barcode", "taxpayerGoodsServiceId"],
  };
  return Object.fromEntries((map[code] ?? []).map((field) => [field, message])) as FieldErrors;
}

export function ProductsPage() {
  const { session } = useAuthSession();
  const active = useActiveContext();
  const [items, setItems] = useState<readonly ProductListItemDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProductDto | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [unitOptions, setUnitOptions] = useState<readonly TaxpayerUnitOption[]>([]);
  const [unitSearch, setUnitSearch] = useState("");
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

  const permissionSet = useMemo(() => new Set(session?.user.permissions ?? []), [session]);
  const can = useCallback(
    (permission: string) => permissionSet.has("system.full-access") || permissionSet.has(permission),
    [permissionSet],
  );
  const actorId = session?.user.id ?? "desktop-local-user";

  const authorization = useMemo<ProductAuthorizationPolicy>(() => ({
    require: async (_context, permission) => {
      if (!can(permission)) throw new ProductApplicationError(PRODUCT_APPLICATION_ERROR_CODES.unauthorized);
    },
  }), [can]);

  const buildAdapters = useCallback(async () => {
    const database = await getDesktopDatabase();
    const reader = new SqliteProductReader(database);
    const service = new ProductService({
      unitOfWork: new SqliteProductUnitOfWork(database),
      reader,
      duplicateDetector: new SqliteProductDuplicateDetector(database),
      idempotency: new SqliteProductIdempotencyExecutor(database),
      taxpayerUnitReferences: new SqliteTaxpayerUnitReferenceValidator(database),
    });
    return {
      reader: new SecuredProductReader(reader, authorization, {
        actorId,
        correlationId: crypto.randomUUID(),
        requestId: crypto.randomUUID(),
      }),
      service: new SecuredProductService(service, authorization, createPersistentProductAuditSink(database)),
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

  useEffect(() => {
    if (!formOpen) return;
    void (async () => {
      try {
        const database = await getDesktopDatabase();
        setUnitOptions(await loadTaxpayerUnitOptions(database));
      } catch (reason) {
        setError(getProductErrorMessage(reason));
      }
    })();
  }, [formOpen]);

  function clearFeedback() {
    setError("");
    setMessage("");
  }

  function startCreate() {
    setSelectedId(null);
    setDetail(null);
    setDraft(emptyDraft);
    setUnitSearch("");
    setFieldErrors({});
    clearFeedback();
    setFormOpen(true);
  }

  function startEdit() {
    if (!detail) return;
    const next = draftFromDetail(detail);
    setDraft(next);
    setUnitSearch(next.baseUnitTitle ? `${next.baseUnitTitle}${next.taxpayerUnitCode ? ` — ${next.taxpayerUnitCode}` : ""}` : "");
    setFieldErrors({});
    clearFeedback();
    setFormOpen(true);
  }

  function selectUnit(value: string) {
    setUnitSearch(value);
    const option = unitOptions.find((item) => item.label === value || item.code === value || item.title === value);
    if (!option) {
      setDraft((current) => ({
        ...current,
        baseUnitId: "",
        baseUnitCode: "",
        baseUnitTitle: "",
        taxpayerUnitCode: "",
      }));
      return;
    }
    setDraft((current) => ({
      ...current,
      baseUnitId: `taxpayer-unit:${option.code}`,
      baseUnitCode: option.code,
      baseUnitTitle: option.title,
      taxpayerUnitCode: option.code,
    }));
    setFieldErrors((current) => ({ ...current, unit: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active.companyId) return;
    const validation = validateDraft(draft);
    if (Object.keys(validation).length > 0) {
      setFieldErrors(validation);
      setError("لطفاً فیلدهای مشخص‌شده را اصلاح کنید.");
      return;
    }
    setSaving(true);
    setFieldErrors({});
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
      const id = detail?.productId ?? selectedId;
      if (id) await loadDetail(id);
    } catch (reason) {
      setFieldErrors(mapErrorToFields(reason));
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
            <form onSubmit={(event) => void submit(event)} noValidate>
              <header><div><p>اطلاعات پایه</p><h2 id="product-form-title">{detail ? "ویرایش کالا / خدمت" : "کالا / خدمت جدید"}</h2></div><button type="button" className="product-dialog__close" aria-label="بستن" onClick={() => setFormOpen(false)} disabled={saving}>×</button></header>
              <div className="product-form-scroll">
                <fieldset><legend>هویت و طبقه‌بندی</legend><div className="product-form-grid">
                  <label><HelpLabel help="نوع رکورد را مشخص می‌کند. نوع کالا/خدمت پس از ایجاد قابل تغییر نیست.">نوع</HelpLabel><select value={draft.kind} disabled={Boolean(detail)} onChange={(event) => setDraft((value) => ({ ...value, kind: event.target.value as ProductKind }))}><option value="product">کالا</option><option value="service">خدمت</option></select></label>
                  <label className={fieldClass(fieldErrors, "code")}><HelpLabel help="کد نمایشی و یکتای کالا/خدمت در همین شرکت است؛ شناسه پایدار سیستم محسوب نمی‌شود.">کد *</HelpLabel><input autoFocus aria-invalid={Boolean(fieldErrors.code)} value={draft.code} onChange={(event) => setDraft((value) => ({ ...value, code: event.target.value }))} /><FieldError errors={fieldErrors} name="code" /></label>
                  <label className={`product-form-grid__wide ${fieldClass(fieldErrors, "title") ?? ""}`}><HelpLabel help="عنوانی است که در فرم‌ها، گزارش‌ها و انتخابگرهای کالا/خدمت نمایش داده می‌شود.">عنوان *</HelpLabel><input aria-invalid={Boolean(fieldErrors.title)} value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} /><FieldError errors={fieldErrors} name="title" /></label>
                  <label><HelpLabel help="شناسه گروه‌بندی کالا/خدمت برای طبقه‌بندی آینده است و اختیاری است.">شناسه گروه</HelpLabel><input value={draft.categoryId} onChange={(event) => setDraft((value) => ({ ...value, categoryId: event.target.value }))} /></label>
                  <label className="product-check"><input type="checkbox" checked={draft.purchasable} onChange={(event) => setDraft((value) => ({ ...value, purchasable: event.target.checked }))} /><HelpLabel help="مشخص می‌کند این رکورد در ماژول خرید آینده قابل انتخاب باشد.">قابل خرید</HelpLabel></label>
                  <label className="product-check"><input type="checkbox" checked={draft.sellable} onChange={(event) => setDraft((value) => ({ ...value, sellable: event.target.checked }))} /><HelpLabel help="مشخص می‌کند این رکورد در ماژول فروش آینده قابل انتخاب باشد.">قابل فروش</HelpLabel></label>
                </div></fieldset>

                <fieldset><legend>شناسه‌ها</legend><div className="product-form-grid">
                  <label className={fieldClass(fieldErrors, "sku")}><HelpLabel help="شناسه تجاری داخلی یا SKU است و برای جستجو و تطبیق استفاده می‌شود.">SKU</HelpLabel><input dir="ltr" aria-invalid={Boolean(fieldErrors.sku)} value={draft.sku} onChange={(event) => setDraft((value) => ({ ...value, sku: event.target.value }))} /><FieldError errors={fieldErrors} name="sku" /></label>
                  <label className={fieldClass(fieldErrors, "referenceCode")}><HelpLabel help="کد مرجع اختیاری برای تطبیق با کاتالوگ یا سیستم‌های دیگر است.">کد مرجع</HelpLabel><input dir="ltr" aria-invalid={Boolean(fieldErrors.referenceCode)} value={draft.referenceCode} onChange={(event) => setDraft((value) => ({ ...value, referenceCode: event.target.value }))} /><FieldError errors={fieldErrors} name="referenceCode" /></label>
                  <label className={fieldClass(fieldErrors, "barcode")}><HelpLabel help="بارکد اصلی کالا است. در مراحل بعد امکان نگهداری چند بارکد نیز وجود دارد.">بارکد اصلی</HelpLabel><input dir="ltr" aria-invalid={Boolean(fieldErrors.barcode)} value={draft.barcode} onChange={(event) => setDraft((value) => ({ ...value, barcode: event.target.value }))} /><FieldError errors={fieldErrors} name="barcode" /></label>
                  <label className={fieldClass(fieldErrors, "taxpayerGoodsServiceId")}><HelpLabel help="شناسه رسمی ۱۳ رقمی کالا/خدمت در سامانه مودیان است و با کد داخلی آرگین تفاوت دارد.">شناسه ۱۳ رقمی مودیان</HelpLabel><input dir="ltr" inputMode="numeric" maxLength={13} aria-invalid={Boolean(fieldErrors.taxpayerGoodsServiceId)} value={draft.taxpayerGoodsServiceId} onChange={(event) => setDraft((value) => ({ ...value, taxpayerGoodsServiceId: event.target.value }))} /><FieldError errors={fieldErrors} name="taxpayerGoodsServiceId" /></label>
                </div></fieldset>

                <fieldset><legend>واحد پایه</legend><div className="product-form-grid">
                  <label className={`product-form-grid__wide ${fieldClass(fieldErrors, "unit") ?? ""}`}><HelpLabel help="نام یا کد واحد را جستجو کنید و یک گزینه از فهرست رسمی سامانه مودیان انتخاب کنید.">انتخاب واحد</HelpLabel><input list="taxpayer-unit-options" placeholder="مثلاً کیلوگرم یا 164" value={unitSearch} aria-invalid={Boolean(fieldErrors.unit)} onChange={(event) => selectUnit(event.target.value)} /><datalist id="taxpayer-unit-options">{unitOptions.map((option) => <option key={option.code} value={option.label} />)}</datalist><FieldError errors={fieldErrors} name="unit" /></label>
                  <label><HelpLabel help="کد رسمی واحد از Reference Data سامانه مودیان و بر اساس انتخاب شما به‌صورت خودکار درج می‌شود.">کد واحد</HelpLabel><input className="product-unit-code" dir="ltr" readOnly value={draft.taxpayerUnitCode} /></label>
                  <label className={fieldClass(fieldErrors, "baseUnitPrecision")}><HelpLabel help="تعداد رقم اعشار مجاز برای مقدار این واحد، بین صفر تا ۶ است.">دقت اعشار</HelpLabel><input type="number" min="0" max="6" aria-invalid={Boolean(fieldErrors.baseUnitPrecision)} value={draft.baseUnitPrecision} onChange={(event) => setDraft((value) => ({ ...value, baseUnitPrecision: event.target.value }))} /><FieldError errors={fieldErrors} name="baseUnitPrecision" /></label>
                  <p className="product-unit-hint">عنوان، کد داخلی واحد و کد رسمی مودیان از گزینه انتخاب‌شده ساخته می‌شوند؛ ورود دستی کد لازم نیست.</p>
                </div></fieldset>

                <fieldset><legend>تجاری و مالیاتی</legend><div className="product-form-grid">
                  <label className={fieldClass(fieldErrors, "brand")}><HelpLabel help="برند یا نام تجاری کالا/خدمت؛ اختیاری و برای جستجو و گزارش‌گیری مفید است.">برند</HelpLabel><input value={draft.brand} onChange={(event) => setDraft((value) => ({ ...value, brand: event.target.value }))} /><FieldError errors={fieldErrors} name="brand" /></label>
                  <label className={fieldClass(fieldErrors, "model")}><HelpLabel help="مدل، تیپ یا شناسه مدل محصول؛ اختیاری است.">مدل</HelpLabel><input value={draft.model} onChange={(event) => setDraft((value) => ({ ...value, model: event.target.value }))} /><FieldError errors={fieldErrors} name="model" /></label>
                  <label className={`product-form-grid__wide ${fieldClass(fieldErrors, "purchaseDescription") ?? ""}`}><HelpLabel help="شرح پیش‌فرض برای استفاده در فرایندهای خرید آینده است.">شرح خرید</HelpLabel><input value={draft.purchaseDescription} onChange={(event) => setDraft((value) => ({ ...value, purchaseDescription: event.target.value }))} /><FieldError errors={fieldErrors} name="purchaseDescription" /></label>
                  <label className={`product-form-grid__wide ${fieldClass(fieldErrors, "salesDescription") ?? ""}`}><HelpLabel help="شرح پیش‌فرض برای استفاده در فرایندهای فروش آینده است.">شرح فروش</HelpLabel><input value={draft.salesDescription} onChange={(event) => setDraft((value) => ({ ...value, salesDescription: event.target.value }))} /><FieldError errors={fieldErrors} name="salesDescription" /></label>
                  <label className={fieldClass(fieldErrors, "taxTreatment")}><HelpLabel help="طبقه‌بندی مالیاتی رکورد: مشمول، معاف، خارج از شمول یا هنوز تعیین‌نشده.">وضعیت مالیاتی</HelpLabel><select aria-invalid={Boolean(fieldErrors.taxTreatment)} value={draft.taxTreatment} onChange={(event) => setDraft((value) => ({ ...value, taxTreatment: event.target.value as ProductTaxTreatment }))}><option value="unspecified">تعیین نشده</option><option value="taxable">مشمول</option><option value="exempt">معاف</option><option value="not-subject">خارج از شمول</option></select><FieldError errors={fieldErrors} name="taxTreatment" /></label>
                  <label className={fieldClass(fieldErrors, "vatRatePercent")}><HelpLabel help="در صورت مشمول بودن، نرخ ارزش افزوده به درصد وارد می‌شود و داخلی به Basis Point ذخیره می‌شود.">نرخ ارزش افزوده (%)</HelpLabel><input type="number" min="0" max="100" step="0.01" disabled={draft.taxTreatment !== "taxable"} aria-invalid={Boolean(fieldErrors.vatRatePercent)} value={draft.vatRatePercent} onChange={(event) => setDraft((value) => ({ ...value, vatRatePercent: event.target.value }))} /><FieldError errors={fieldErrors} name="vatRatePercent" /></label>
                </div></fieldset>

                <fieldset><legend>ویژگی‌های عملیاتی</legend><div className="product-form-grid product-form-grid--checks">
                  <label className={`product-check ${fieldClass(fieldErrors, "stockTracking") ?? ""}`}><input type="checkbox" disabled={draft.kind === "service"} checked={draft.stockTracking} onChange={(event) => setDraft((value) => ({ ...value, stockTracking: event.target.checked }))} /><HelpLabel help="فقط برای کالا؛ مشخص می‌کند موجودی آن در ماژول انبار آینده ردیابی شود.">ردیابی موجودی</HelpLabel><FieldError errors={fieldErrors} name="stockTracking" /></label>
                  <label className={`product-check ${fieldClass(fieldErrors, "serialTracking") ?? ""}`}><input type="checkbox" disabled={draft.kind === "service" || !draft.stockTracking} checked={draft.serialTracking} onChange={(event) => setDraft((value) => ({ ...value, serialTracking: event.target.checked }))} /><HelpLabel help="برای کالاهای دارای شماره سریال یکتا؛ نیازمند فعال بودن ردیابی موجودی است.">ردیابی سریال</HelpLabel><FieldError errors={fieldErrors} name="serialTracking" /></label>
                  <label className={`product-check ${fieldClass(fieldErrors, "lotTracking") ?? ""}`}><input type="checkbox" disabled={draft.kind === "service" || !draft.stockTracking} checked={draft.lotTracking} onChange={(event) => setDraft((value) => ({ ...value, lotTracking: event.target.checked }))} /><HelpLabel help="برای کالاهایی که بر اساس بچ/لات مدیریت می‌شوند؛ نیازمند ردیابی موجودی است.">ردیابی بچ</HelpLabel><FieldError errors={fieldErrors} name="lotTracking" /></label>
                  <label className={fieldClass(fieldErrors, "shelfLifeDays")}><HelpLabel help="عمر نگهداری کالا به روز؛ فقط برای کالاهای دارای ردیابی موجودی کاربرد دارد.">عمر نگهداری (روز)</HelpLabel><input type="number" min="1" disabled={draft.kind === "service" || !draft.stockTracking} aria-invalid={Boolean(fieldErrors.shelfLifeDays)} value={draft.shelfLifeDays} onChange={(event) => setDraft((value) => ({ ...value, shelfLifeDays: event.target.value }))} /><FieldError errors={fieldErrors} name="shelfLifeDays" /></label>
                </div></fieldset>
              </div>
              <footer><span>فیلدهای دارای * الزامی هستند. علامت سؤال کنار هر فیلد راهنمای همان فیلد را نمایش می‌دهد.</span><div><button className="product-button" type="button" onClick={() => setFormOpen(false)} disabled={saving}>انصراف</button><button className="product-button product-button--primary" type="submit" disabled={saving}>{saving ? "در حال ذخیره…" : "ذخیره"}</button></div></footer>
            </form>
          </section>
        </div>
      )}
    </Page>
  );
}
