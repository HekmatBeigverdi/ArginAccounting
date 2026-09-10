import {
  Fragment,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  InventoryDocumentDetail,
  InventoryKardexReport,
  InventoryProductBalanceSummaryReport,
  InventoryProductBalanceSummaryRow,
  InventoryQuantityBalanceReport,
  InventoryQuantityBalanceReportRow,
  InventoryStockKey,
} from "@argin/inventory";
import { getDesktopDatabase } from "@argin/database-tauri";
import type { ProductSelectorItemDto } from "@argin/product";
import type {
  WarehouseListItemDto,
  WarehouseLocationDto,
  WarehouseZoneDto,
} from "@argin/warehouse";
import { useActiveContext } from "../../app/providers/active-context-provider";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { Feedback } from "../../components/feedback";
import { Page } from "../../components/layout";
import {
  createInventoryReportServices,
  type InventoryReportServices,
} from "../../composition/inventory/create-inventory-report-services";
import { gregorianToJalali, jalaliToGregorian } from "./inventory-persian-date";
import "./inventory-quantity-reports-page.css";

type Tab = "balances" | "kardex";
type BalanceView = "summary" | "locations";
type ScopeMode = "company" | "branch";

const todayJalali = (): string =>
  gregorianToJalali(new Date().toISOString().slice(0, 10));

const DOCUMENT_TYPE_LABELS = {
  receipt: "رسید انبار",
  issue: "حواله انبار",
  opening: "موجودی اول دوره",
  transfer: "انتقال بین انبارها",
  adjustment: "اصلاح موجودی",
} as const;

const DOCUMENT_STATUS_LABELS = {
  draft: "پیش‌نویس",
  submitted: "ارسال‌شده",
  approved: "تأییدشده",
  confirmed: "قطعی",
  cancelled: "لغوشده",
  reversed: "برگشت‌شده",
} as const;

export function InventoryQuantityReportsPage() {
  const active = useActiveContext();
  const { session } = useAuthSession();
  const [services, setServices] = useState<InventoryReportServices | null>(
    null,
  );
  const [tab, setTab] = useState<Tab>("balances");
  const [balanceView, setBalanceView] = useState<BalanceView>("summary");
  const [scopeMode, setScopeMode] = useState<ScopeMode>("company");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [summaries, setSummaries] =
    useState<InventoryProductBalanceSummaryReport | null>(null);
  const [summaryCursor, setSummaryCursor] = useState<string | null>(null);
  const [summaryCursorStack, setSummaryCursorStack] = useState<
    (string | null)[]
  >([]);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(
    null,
  );

  const [balances, setBalances] =
    useState<InventoryQuantityBalanceReport | null>(null);
  const [balanceCursor, setBalanceCursor] = useState<string | null>(null);
  const [balanceCursorStack, setBalanceCursorStack] = useState<
    (string | null)[]
  >([]);
  const [kardex, setKardex] = useState<InventoryKardexReport | null>(null);
  const [kardexCursor, setKardexCursor] = useState<string | null>(null);
  const [kardexCursorStack, setKardexCursorStack] = useState<(string | null)[]>(
    [],
  );
  const [selectedStockKey, setSelectedStockKey] =
    useState<InventoryStockKey | null>(null);
  const [selectedBalance, setSelectedBalance] =
    useState<InventoryQuantityBalanceReportRow | null>(null);
  const [sourceDetail, setSourceDetail] =
    useState<InventoryDocumentDetail | null>(null);
  const [sourceLineId, setSourceLineId] = useState<string | null>(null);

  const [products, setProducts] = useState<readonly ProductSelectorItemDto[]>(
    [],
  );
  const [warehouses, setWarehouses] = useState<readonly WarehouseListItemDto[]>(
    [],
  );
  const [zones, setZones] = useState<readonly WarehouseZoneDto[]>([]);
  const [locations, setLocations] = useState<readonly WarehouseLocationDto[]>(
    [],
  );
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [includeZero, setIncludeZero] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(todayJalali());

  const actor = useMemo(
    () => ({
      permissions: session?.user.permissions ?? [],
      branchIds: session?.user.branchIds ?? [],
    }),
    [session],
  );

  useEffect(() => {
    let mounted = true;
    void getDesktopDatabase()
      .then((database) => {
        if (mounted)
          setServices(createInventoryReportServices({ database, actor }));
      })
      .catch((reason) => {
        if (mounted)
          setError(
            reason instanceof Error
              ? reason.message
              : "راه‌اندازی گزارش موجودی با خطا مواجه شد.",
          );
      });
    return () => {
      mounted = false;
    };
  }, [actor]);

  useEffect(() => {
    if (services && !services.canViewCompanyWide && scopeMode === "company")
      setScopeMode("branch");
  }, [services, scopeMode]);

  const reportBranchId = useMemo<string | null>(() => {
    if (services?.canViewCompanyWide && scopeMode === "company") return null;
    return active.branchId || null;
  }, [services, scopeMode, active.branchId]);

  const scopeLabel =
    services?.canViewCompanyWide && scopeMode === "company"
      ? "کل شرکت"
      : "محدوده شعبه فعال";

  const loadSelectors = useCallback(async () => {
    if (!services || !active.companyId || !services.canView) return;
    const [productOptions, warehouseOptions] = await Promise.all([
      services.selectProducts(active.companyId),
      services.selectWarehouses(active.companyId, reportBranchId),
    ]);
    setProducts(productOptions);
    setWarehouses(warehouseOptions);
  }, [services, active.companyId, reportBranchId]);

  useEffect(() => {
    void loadSelectors().catch((reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "بارگذاری انتخابگرها ناموفق بود.",
      ),
    );
  }, [loadSelectors]);

  const loadSummaries = useCallback(
    async (cursor: string | null = summaryCursor) => {
      if (!services || !active.companyId) return;
      setLoading(true);
      setError("");
      try {
        setSummaries(
          await services.readProductSummaries({
            companyId: active.companyId,
            branchId: reportBranchId,
            productId: productId || null,
            includeZero,
            cursor,
            limit: 50,
          }),
        );
        setSummaryCursor(cursor);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "خواندن نمای تجمیعی موجودی با خطا مواجه شد.",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      services,
      active.companyId,
      reportBranchId,
      productId,
      includeZero,
      summaryCursor,
    ],
  );

  const loadBalances = useCallback(
    async (
      cursor: string | null = balanceCursor,
      override?: { productId?: string; warehouseId?: string },
    ) => {
      if (!services || !active.companyId) return;
      setLoading(true);
      setError("");
      try {
        setBalances(
          await services.readBalances({
            companyId: active.companyId,
            branchId: reportBranchId,
            productId: (override?.productId ?? productId) || null,
            warehouseId: (override?.warehouseId ?? warehouseId) || null,
            zoneId: override ? null : zoneId || null,
            locationId: override ? null : locationId || null,
            includeZero,
            cursor,
            limit: 100,
          }),
        );
        setBalanceCursor(cursor);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "خواندن موجودی با خطا مواجه شد.",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      services,
      active.companyId,
      reportBranchId,
      productId,
      warehouseId,
      zoneId,
      locationId,
      includeZero,
      balanceCursor,
    ],
  );

  useEffect(() => {
    if (!services || !active.companyId || tab !== "balances") return;
    if (balanceView === "summary") void loadSummaries(null);
    else void loadBalances(null);
  }, [services, active.companyId, reportBranchId, tab, balanceView]);

  async function chooseWarehouse(value: string): Promise<void> {
    setWarehouseId(value);
    setZoneId("");
    setLocationId("");
    setLocations([]);
    if (!services || !active.companyId || !value) return setZones([]);
    setZones(await services.listZones(active.companyId, value));
  }

  async function chooseZone(value: string): Promise<void> {
    setZoneId(value);
    setLocationId("");
    if (!services || !active.companyId || !warehouseId || !value)
      return setLocations([]);
    setLocations(
      await services.listLocations(active.companyId, warehouseId, value),
    );
  }

  async function submitBalanceFilters(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (balanceView === "summary") {
      setSummaryCursorStack([]);
      await loadSummaries(null);
    } else {
      setBalanceCursorStack([]);
      await loadBalances(null);
    }
  }

  async function showWarehouseBreakdown(
    product: InventoryProductBalanceSummaryRow,
    targetWarehouseId: string,
  ): Promise<void> {
    setProductId(product.productId);
    setWarehouseId(targetWarehouseId);
    setZoneId("");
    setLocationId("");
    setBalanceCursorStack([]);
    setBalanceView("locations");
    await loadBalances(null, {
      productId: product.productId,
      warehouseId: targetWarehouseId,
    });
    if (services && active.companyId)
      setZones(await services.listZones(active.companyId, targetWarehouseId));
  }

  const loadKardex = useCallback(
    async (key: InventoryStockKey, cursor: string | null) => {
      if (!services || !active.companyId) return;
      setLoading(true);
      setError("");
      setSourceDetail(null);
      try {
        const from = dateFrom.trim() ? jalaliToGregorian(dateFrom) : null;
        const to = dateTo.trim() ? jalaliToGregorian(dateTo) : null;
        if (from && to && from > to)
          throw new Error("تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.");
        setKardex(
          await services.readKardex({
            companyId: active.companyId,
            branchId: reportBranchId,
            stockKey: key,
            businessDateFrom: from,
            businessDateTo: to,
            cursor,
            limit: 100,
          }),
        );
        setKardexCursor(cursor);
        setSelectedStockKey(key);
        setTab("kardex");
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "خواندن کاردکس با خطا مواجه شد.",
        );
      } finally {
        setLoading(false);
      }
    },
    [services, active.companyId, reportBranchId, dateFrom, dateTo],
  );

  function openBalanceKardex(row: InventoryQuantityBalanceReportRow): void {
    setKardexCursorStack([]);
    setSelectedBalance(row);
    void loadKardex(row.stockKey, null);
  }

  async function openSource(documentId: string, lineId: string): Promise<void> {
    if (!services || !active.companyId) return;
    setLoading(true);
    setError("");
    try {
      setSourceDetail(
        await services.getDocument(
          active.companyId,
          reportBranchId,
          documentId,
        ),
      );
      setSourceLineId(lineId);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "بازکردن سند مبدأ با خطا مواجه شد.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (services && !services.canView)
    return (
      <Page>
        <Feedback tone="error">
          برای مشاهده گزارش‌های موجودی مجوز کافی ندارید.
        </Feedback>
      </Page>
    );

  return (
    <Page className="inventory-report-page" dir="rtl">
      <header className="inventory-report-page__header">
        <div>
          <h2>گزارش‌های کمّی انبار</h2>
          <p>
            {
              "دید مدیریتی کالا، تفکیک محل نگهداری و کاردکس تعدادی؛ بدون ارزش‌گذاری ریالی."
            }
          </p>
        </div>
        <div
          className="inventory-report-page__tabs"
          role="tablist"
          aria-label="نوع گزارش"
        >
          <button
            type="button"
            className={tab === "balances" ? "active" : ""}
            onClick={() => setTab("balances")}
          >
            موجودی
          </button>
          <button
            type="button"
            className={tab === "kardex" ? "active" : ""}
            disabled={!selectedStockKey}
            onClick={() => setTab("kardex")}
          >
            کاردکس
          </button>
        </div>
      </header>

      {error && <Feedback tone="error">{error}</Feedback>}
      <section className="inventory-report-note" aria-label="توضیح گزارش">
        <strong>محدوده فعلی: {scopeLabel}.</strong> موجودی‌ها بر حسب واحد پایه
        کالا و از balance projection بازسازی‌پذیر نمایش داده می‌شوند. کاردکس از
        movementهای قطعی و با ترتیب تاریخ عملیات ← ترتیب روز ← سند ← ردیف ←
        movement ساخته می‌شود. On-hand با رزرو و Available-to-Promise متفاوت
        است.
      </section>

      {tab === "balances" && (
        <>
          <div className="inventory-balance-toolbar">
            <div
              className="inventory-view-switch"
              role="group"
              aria-label="نمای موجودی"
            >
              <button
                type="button"
                className={balanceView === "summary" ? "active" : ""}
                onClick={() => {
                  setBalanceView("summary");
                  setExpandedProductId(null);
                }}
              >
                تجمیعی کالا
              </button>
              <button
                type="button"
                className={balanceView === "locations" ? "active" : ""}
                onClick={() => setBalanceView("locations")}
              >
                تفکیک انبار و موقعیت
              </button>
            </div>
            {services?.canViewCompanyWide && (
              <label className="inventory-scope-switch">
                محدوده گزارش
                <select
                  value={scopeMode}
                  onChange={(e) => {
                    setScopeMode(e.target.value as ScopeMode);
                    setSummaryCursorStack([]);
                    setBalanceCursorStack([]);
                  }}
                >
                  <option value="company">کل شرکت</option>
                  <option value="branch">شعبه فعال</option>
                </select>
              </label>
            )}
          </div>

          <form
            className="inventory-report-filters"
            onSubmit={submitBalanceFilters}
          >
            <label>
              کالا
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="">همه کالاها</option>
                {products.map((product) => (
                  <option key={product.productId} value={product.productId}>
                    {product.code} — {product.title}
                  </option>
                ))}
              </select>
            </label>
            {balanceView === "locations" && (
              <>
                <label>
                  انبار
                  <select
                    value={warehouseId}
                    onChange={(e) => void chooseWarehouse(e.target.value)}
                  >
                    <option value="">همه انبارها</option>
                    {warehouses.map((warehouse) => (
                      <option
                        key={warehouse.warehouseId}
                        value={warehouse.warehouseId}
                      >
                        {warehouse.code} — {warehouse.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ناحیه
                  <select
                    value={zoneId}
                    disabled={!warehouseId}
                    onChange={(e) => void chooseZone(e.target.value)}
                  >
                    <option value="">همه ناحیه‌ها</option>
                    {zones.map((zone) => (
                      <option key={zone.zoneId} value={zone.zoneId}>
                        {zone.code} — {zone.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  موقعیت
                  <select
                    value={locationId}
                    disabled={!zoneId}
                    onChange={(e) => setLocationId(e.target.value)}
                  >
                    <option value="">همه موقعیت‌ها</option>
                    {locations.map((location) => (
                      <option
                        key={location.locationId}
                        value={location.locationId}
                      >
                        {location.code} — {location.title}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label className="inventory-report-checkbox">
              <input
                type="checkbox"
                checked={includeZero}
                onChange={(e) => setIncludeZero(e.target.checked)}
              />{" "}
              نمایش موجودی صفر
            </label>
            <button type="submit" disabled={loading}>
              اعمال فیلتر
            </button>
          </form>

          {balanceView === "summary" ? (
            <>
              <ProductSummaryTable
                summaries={summaries}
                loading={loading}
                scopeLabel={scopeLabel}
                expandedProductId={expandedProductId}
                onToggleExpansion={(productId) =>
                  setExpandedProductId((current) =>
                    current === productId ? null : productId,
                  )
                }
                showWarehouseBreakdown={showWarehouseBreakdown}
              />
              <div className="inventory-report-pagination">
                <button
                  type="button"
                  disabled={!summaryCursorStack.length || loading}
                  onClick={() => {
                    const stack = [...summaryCursorStack];
                    const previous = stack.pop() ?? null;
                    setSummaryCursorStack(stack);
                    void loadSummaries(previous);
                  }}
                >
                  قبلی
                </button>
                <button
                  type="button"
                  disabled={!summaries?.nextCursor || loading}
                  onClick={() => {
                    if (!summaries?.nextCursor) return;
                    setSummaryCursorStack((stack) => [...stack, summaryCursor]);
                    void loadSummaries(summaries.nextCursor);
                  }}
                >
                  بعدی
                </button>
              </div>
            </>
          ) : (
            <>
              <LocationBalancesTable
                balances={balances}
                loading={loading}
                openBalanceKardex={openBalanceKardex}
              />
              <div className="inventory-report-pagination">
                <button
                  type="button"
                  disabled={!balanceCursorStack.length || loading}
                  onClick={() => {
                    const stack = [...balanceCursorStack];
                    const previous = stack.pop() ?? null;
                    setBalanceCursorStack(stack);
                    void loadBalances(previous);
                  }}
                >
                  قبلی
                </button>
                <button
                  type="button"
                  disabled={!balances?.nextCursor || loading}
                  onClick={() => {
                    if (!balances?.nextCursor) return;
                    setBalanceCursorStack((stack) => [...stack, balanceCursor]);
                    void loadBalances(balances.nextCursor);
                  }}
                >
                  بعدی
                </button>
              </div>
            </>
          )}
        </>
      )}

      {tab === "kardex" && selectedStockKey && (
        <>
          {selectedBalance && (
            <section
              className="inventory-kardex-heading"
              aria-label="مشخصات کاردکس کالا"
            >
              <div>
                <span>کالا</span>
                <strong>{selectedBalance.productTitle}</strong>
                <bdi dir="ltr">کد: {selectedBalance.productCode}</bdi>
              </div>
              <div>
                <span>انبار و محل نگهداری</span>
                <strong>{selectedBalance.warehouseTitle}</strong>
                <small>
                  {[selectedBalance.zoneTitle, selectedBalance.locationTitle]
                    .filter(Boolean)
                    .join(" / ") || "بدون ناحیه و موقعیت"}
                </small>
              </div>
            </section>
          )}
          <form
            className="inventory-report-filters inventory-report-filters--kardex"
            onSubmit={(event) => {
              event.preventDefault();
              setKardexCursorStack([]);
              void loadKardex(selectedStockKey, null);
            }}
          >
            <label>
              از تاریخ شمسی
              <input
                dir="ltr"
                inputMode="numeric"
                placeholder="۱۴۰۵/۰۱/۰۱"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label>
              تا تاریخ شمسی
              <input
                dir="ltr"
                inputMode="numeric"
                placeholder="۱۴۰۵/۱۲/۲۹"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
            <button type="submit" disabled={loading}>
              اعمال بازه
            </button>
          </form>
          {kardex && (
            <div className="inventory-report-summary">
              <div>
                <span>مانده ابتدای صفحه/بازه</span>
                <strong dir="ltr">{kardex.openingQuantity}</strong>
              </div>
              <div>
                <span>ورودی این صفحه</span>
                <strong dir="ltr">{kardex.incomingQuantity}</strong>
              </div>
              <div>
                <span>خروجی این صفحه</span>
                <strong dir="ltr">{kardex.outgoingQuantity}</strong>
              </div>
              <div>
                <span>مانده انتهای صفحه</span>
                <strong dir="ltr">{kardex.closingQuantity}</strong>
              </div>
            </div>
          )}
          <KardexTable
            kardex={kardex}
            loading={loading}
            openSource={openSource}
          />
          <div className="inventory-report-pagination">
            <button
              type="button"
              disabled={!kardexCursorStack.length || loading}
              onClick={() => {
                const stack = [...kardexCursorStack];
                const previous = stack.pop() ?? null;
                setKardexCursorStack(stack);
                void loadKardex(selectedStockKey, previous);
              }}
            >
              قبلی
            </button>
            <button
              type="button"
              disabled={!kardex?.nextCursor || loading}
              onClick={() => {
                if (!kardex?.nextCursor) return;
                setKardexCursorStack((stack) => [...stack, kardexCursor]);
                void loadKardex(selectedStockKey, kardex.nextCursor);
              }}
            >
              بعدی
            </button>
          </div>
        </>
      )}

      {sourceDetail && (
        <SourceDocumentDetails
          sourceDetail={sourceDetail}
          sourceLineId={sourceLineId}
          selectedBalance={selectedBalance}
          onClose={() => setSourceDetail(null)}
        />
      )}
    </Page>
  );
}

interface ProductSummaryTableProps {
  summaries: InventoryProductBalanceSummaryReport | null;
  loading: boolean;
  scopeLabel: string;
  expandedProductId: string | null;
  onToggleExpansion: (productId: string) => void;
  showWarehouseBreakdown: (
    product: InventoryProductBalanceSummaryRow,
    warehouseId: string,
  ) => Promise<void>;
}

function ProductSummaryTable({
  summaries,
  loading,
  scopeLabel,
  expandedProductId,
  onToggleExpansion,
  showWarehouseBreakdown,
}: ProductSummaryTableProps) {
  return (
    <div className="inventory-report-table-wrap">
      <table className="inventory-report-table inventory-product-summary-table">
        <thead>
          <tr>
            <th>کالا</th>
            <th>موجودی کل ({scopeLabel})</th>
            <th>تعداد انبار</th>
            <th>محل‌های موجودی</th>
            <th>عملیات</th>
          </tr>
        </thead>
        <tbody>
          {summaries?.items.map((row) => (
            <Fragment key={row.productId}>
              <tr>
                <td>
                  <bdi dir="ltr">{row.productCode}</bdi>
                  <span>{row.productTitle}</span>
                </td>
                <td className="inventory-total-quantity">
                  <bdi dir="ltr">{row.totalQuantity}</bdi>
                  <small>واحد پایه کالا</small>
                </td>
                <td>{row.warehouseCount}</td>
                <td>{row.stockKeyCount}</td>
                <td>
                  <button
                    type="button"
                    aria-expanded={expandedProductId === row.productId}
                    onClick={() => onToggleExpansion(row.productId)}
                  >
                    تفکیک انبارها
                  </button>
                </td>
              </tr>
              {expandedProductId === row.productId && (
                <tr className="inventory-product-breakdown-row">
                  <td colSpan={5}>
                    <div className="inventory-product-breakdown">
                      <header>
                        <strong>{row.productTitle}</strong>
                        <span>
                          جمع {scopeLabel}:{" "}
                          <bdi dir="ltr">{row.totalQuantity}</bdi>
                        </span>
                      </header>
                      {row.warehouses.map((warehouse) => (
                        <div
                          className="inventory-warehouse-summary"
                          key={warehouse.warehouseId}
                        >
                          <div>
                            <bdi dir="ltr">{warehouse.warehouseCode}</bdi>
                            <strong>{warehouse.warehouseTitle}</strong>
                          </div>
                          <div>
                            <span>موجودی</span>
                            <bdi dir="ltr">{warehouse.quantity}</bdi>
                          </div>
                          <div>
                            <span>تعداد موقعیت/StockKey</span>
                            <bdi dir="ltr">{warehouse.stockKeyCount}</bdi>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              void showWarehouseBreakdown(
                                row,
                                warehouse.warehouseId,
                              )
                            }
                          >
                            نمایش ریز انبار
                          </button>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {!loading && summaries?.items.length === 0 && (
            <tr>
              <td colSpan={5}>برای این محدوده موجودی ثبت‌شده‌ای وجود ندارد.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface LocationBalancesTableProps {
  balances: InventoryQuantityBalanceReport | null;
  loading: boolean;
  openBalanceKardex: (row: InventoryQuantityBalanceReportRow) => void;
}

function LocationBalancesTable({
  balances,
  loading,
  openBalanceKardex,
}: LocationBalancesTableProps) {
  return (
    <div className="inventory-report-table-wrap">
      <table className="inventory-report-table">
        <thead>
          <tr>
            <th>کالا</th>
            <th>انبار</th>
            <th>ناحیه / موقعیت</th>
            <th>موجودی پایه</th>
            <th>عملیات</th>
          </tr>
        </thead>
        <tbody>
          {balances?.items.map((row) => (
            <tr key={JSON.stringify(row.stockKey)}>
              <td>
                <bdi dir="ltr">{row.productCode}</bdi>
                <span>{row.productTitle}</span>
              </td>
              <td>
                <bdi dir="ltr">{row.warehouseCode}</bdi>
                <span>{row.warehouseTitle}</span>
              </td>
              <td>
                {row.zoneTitle ?? "—"}
                {row.locationTitle ? ` / ${row.locationTitle}` : ""}
              </td>
              <td>
                <bdi dir="ltr">{row.quantity}</bdi>
              </td>
              <td>
                <button type="button" onClick={() => openBalanceKardex(row)}>
                  نمایش کاردکس
                </button>
              </td>
            </tr>
          ))}
          {!loading && balances?.items.length === 0 && (
            <tr>
              <td colSpan={5}>موردی مطابق فیلتر پیدا نشد.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface KardexTableProps {
  kardex: InventoryKardexReport | null;
  loading: boolean;
  openSource: (documentId: string, lineId: string) => Promise<void>;
}

function KardexTable({ kardex, loading, openSource }: KardexTableProps) {
  return (
    <div className="inventory-report-table-wrap">
      <table className="inventory-report-table inventory-report-table--kardex">
        <thead>
          <tr>
            <th>ردیف</th>
            <th>تاریخ</th>
            <th>نوع سند</th>
            <th>شماره سند</th>
            <th>شرح</th>
            <th>وارده</th>
            <th>صادره</th>
            <th>مانده</th>
            <th>عملیات</th>
          </tr>
        </thead>
        <tbody>
          {kardex?.entries.map((entry, index) => (
            <tr key={entry.movement.movementId}>
              <td className="inventory-kardex-number">{index + 1}</td>
              <td>{gregorianToJalali(entry.movement.businessDate)}</td>
              <td>
                {entry.source.isReversal ? "برگشت " : ""}
                {DOCUMENT_TYPE_LABELS[entry.source.documentType]}
              </td>
              <td dir="ltr">{entry.source.documentNumber ?? "بدون شماره"}</td>
              <td className="inventory-kardex-description">
                {entry.source.lineDescription ??
                  entry.source.documentDescription ??
                  "—"}
              </td>
              <td dir="ltr" className="inventory-kardex-quantity">
                {entry.incomingQuantity === "0" ? "—" : entry.incomingQuantity}
              </td>
              <td dir="ltr" className="inventory-kardex-quantity">
                {entry.outgoingQuantity === "0" ? "—" : entry.outgoingQuantity}
              </td>
              <td dir="ltr" className="inventory-kardex-balance">
                {entry.runningQuantity}
              </td>
              <td>
                <button
                  className="inventory-kardex-detail-button"
                  type="button"
                  onClick={() =>
                    void openSource(
                      entry.source.documentId,
                      entry.source.lineId,
                    )
                  }
                >
                  مشاهده سند
                </button>
              </td>
            </tr>
          ))}
          {!loading && kardex?.entries.length === 0 && (
            <tr>
              <td colSpan={9}>در این بازه گردش انباری وجود ندارد.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface SourceDocumentDetailsProps {
  sourceDetail: InventoryDocumentDetail;
  sourceLineId: string | null;
  selectedBalance: InventoryQuantityBalanceReportRow | null;
  onClose: () => void;
}

function SourceDocumentDetails({
  sourceDetail,
  sourceLineId,
  selectedBalance,
  onClose,
}: SourceDocumentDetailsProps) {
  return (
    <aside className="inventory-source-drilldown" aria-label="جزئیات سند مبدأ">
      <header>
        <div>
          <h3>سند مبدأ</h3>
          <bdi dir="ltr">
            {sourceDetail.document.documentNumber ?? "بدون شماره"}
          </bdi>
        </div>
        <button type="button" onClick={onClose}>
          بستن
        </button>
      </header>
      <dl>
        <div>
          <dt>نوع</dt>
          <dd>{DOCUMENT_TYPE_LABELS[sourceDetail.document.documentType]}</dd>
        </div>
        <div>
          <dt>تاریخ</dt>
          <dd>{gregorianToJalali(sourceDetail.document.businessDate)}</dd>
        </div>
        <div>
          <dt>وضعیت</dt>
          <dd>{DOCUMENT_STATUS_LABELS[sourceDetail.document.status]}</dd>
        </div>
      </dl>
      <h4>ردیف اثرگذار</h4>
      {sourceDetail.document.lines
        .filter((line) => line.lineId === sourceLineId)
        .map((line) => (
          <div className="inventory-source-line" key={line.lineId}>
            <span>ردیف {line.position}</span>
            <strong>
              {selectedBalance?.productTitle ?? "کالای انتخاب‌شده"}
              {selectedBalance?.productCode && (
                <>
                  {" "}
                  — <bdi dir="ltr">{selectedBalance.productCode}</bdi>
                </>
              )}
            </strong>
            <span>
              مقدار:{" "}
              <bdi dir="ltr">
                {line.operation?.quantity.enteredQuantity ?? "—"}
              </bdi>
              {line.operation?.quantity.enteredUnit.title
                ? ` ${line.operation.quantity.enteredUnit.title}`
                : ""}
            </span>
            <span>
              محل:{" "}
              {selectedBalance
                ? [
                    selectedBalance.warehouseTitle,
                    selectedBalance.zoneTitle,
                    selectedBalance.locationTitle,
                  ]
                    .filter(Boolean)
                    .join(" / ")
                : "—"}
            </span>
            <span>
              شرح:{" "}
              {line.description ?? sourceDetail.document.description ?? "—"}
            </span>
          </div>
        ))}
    </aside>
  );
}
