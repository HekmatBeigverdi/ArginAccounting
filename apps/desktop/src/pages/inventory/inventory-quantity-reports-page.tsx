import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { InventoryDocumentDetail, InventoryKardexReport, InventoryQuantityBalanceReport, InventoryQuantityBalanceReportRow, InventoryStockKey } from "@argin/inventory";
import { getDesktopDatabase } from "@argin/database-tauri";
import type { ProductSelectorItemDto } from "@argin/product";
import type { WarehouseListItemDto, WarehouseLocationDto, WarehouseZoneDto } from "@argin/warehouse";
import { useActiveContext } from "../../app/providers/active-context-provider";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { Feedback } from "../../components/feedback";
import { Page } from "../../components/layout";
import { createInventoryReportServices, type InventoryReportServices } from "../../composition/inventory/create-inventory-report-services";
import { gregorianToJalali, jalaliToGregorian } from "./inventory-persian-date";
import "./inventory-quantity-reports-page.css";

type Tab = "balances" | "kardex";

const todayJalali = (): string => gregorianToJalali(new Date().toISOString().slice(0, 10));
const ltr = (value: string | null): string => value ?? "—";

export function InventoryQuantityReportsPage() {
  const active = useActiveContext();
  const { session } = useAuthSession();
  const [services, setServices] = useState<InventoryReportServices | null>(null);
  const [tab, setTab] = useState<Tab>("balances");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [balances, setBalances] = useState<InventoryQuantityBalanceReport | null>(null);
  const [balanceCursor, setBalanceCursor] = useState<string | null>(null);
  const [balanceCursorStack, setBalanceCursorStack] = useState<(string | null)[]>([]);
  const [kardex, setKardex] = useState<InventoryKardexReport | null>(null);
  const [kardexCursor, setKardexCursor] = useState<string | null>(null);
  const [kardexCursorStack, setKardexCursorStack] = useState<(string | null)[]>([]);
  const [selectedStockKey, setSelectedStockKey] = useState<InventoryStockKey | null>(null);
  const [sourceDetail, setSourceDetail] = useState<InventoryDocumentDetail | null>(null);
  const [sourceLineId, setSourceLineId] = useState<string | null>(null);
  const [products, setProducts] = useState<readonly ProductSelectorItemDto[]>([]);
  const [warehouses, setWarehouses] = useState<readonly WarehouseListItemDto[]>([]);
  const [zones, setZones] = useState<readonly WarehouseZoneDto[]>([]);
  const [locations, setLocations] = useState<readonly WarehouseLocationDto[]>([]);
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [includeZero, setIncludeZero] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(todayJalali());

  const actor = useMemo(() => ({
    permissions: session?.user.permissions ?? [],
    branchIds: session?.user.branchIds ?? [],
  }), [session]);

  useEffect(() => {
    let mounted = true;
    void getDesktopDatabase()
      .then((database) => { if (mounted) setServices(createInventoryReportServices({ database, actor })); })
      .catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : "راه‌اندازی گزارش موجودی با خطا مواجه شد."); });
    return () => { mounted = false; };
  }, [actor]);

  const loadSelectors = useCallback(async () => {
    if (!services || !active.companyId || !services.canView) return;
    const [productOptions, warehouseOptions] = await Promise.all([
      services.selectProducts(active.companyId),
      services.selectWarehouses(active.companyId, active.branchId || null),
    ]);
    setProducts(productOptions);
    setWarehouses(warehouseOptions);
  }, [services, active.companyId, active.branchId]);

  useEffect(() => { void loadSelectors().catch((reason) => setError(reason instanceof Error ? reason.message : "بارگذاری انتخابگرها ناموفق بود.")); }, [loadSelectors]);

  const loadBalances = useCallback(async (cursor: string | null = balanceCursor) => {
    if (!services || !active.companyId) return;
    setLoading(true); setError("");
    try {
      setBalances(await services.readBalances({
        companyId: active.companyId,
        productId: productId || null,
        warehouseId: warehouseId || null,
        zoneId: zoneId || null,
        locationId: locationId || null,
        includeZero,
        cursor,
        limit: 100,
      }));
      setBalanceCursor(cursor);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "خواندن موجودی با خطا مواجه شد.");
    } finally { setLoading(false); }
  }, [services, active.companyId, productId, warehouseId, zoneId, locationId, includeZero, balanceCursor]);

  useEffect(() => { if (services && active.companyId && tab === "balances") void loadBalances(null); }, [services, active.companyId, tab]);

  async function chooseWarehouse(value: string): Promise<void> {
    setWarehouseId(value); setZoneId(""); setLocationId(""); setLocations([]);
    if (!services || !active.companyId || !value) return setZones([]);
    setZones(await services.listZones(active.companyId, value));
  }

  async function chooseZone(value: string): Promise<void> {
    setZoneId(value); setLocationId("");
    if (!services || !active.companyId || !warehouseId || !value) return setLocations([]);
    setLocations(await services.listLocations(active.companyId, warehouseId, value));
  }

  async function submitBalanceFilters(event: FormEvent): Promise<void> {
    event.preventDefault(); setBalanceCursorStack([]); await loadBalances(null);
  }

  const loadKardex = useCallback(async (key: InventoryStockKey, cursor: string | null) => {
    if (!services || !active.companyId) return;
    setLoading(true); setError(""); setSourceDetail(null);
    try {
      const from = dateFrom.trim() ? jalaliToGregorian(dateFrom) : null;
      const to = dateTo.trim() ? jalaliToGregorian(dateTo) : null;
      if (from && to && from > to) throw new Error("تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.");
      setKardex(await services.readKardex({ companyId: active.companyId, stockKey: key, businessDateFrom: from, businessDateTo: to, cursor, limit: 100 }));
      setKardexCursor(cursor);
      setSelectedStockKey(key);
      setTab("kardex");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "خواندن کاردکس با خطا مواجه شد.");
    } finally { setLoading(false); }
  }, [services, active.companyId, dateFrom, dateTo]);

  function openBalanceKardex(row: InventoryQuantityBalanceReportRow): void {
    setKardexCursorStack([]);
    void loadKardex(row.stockKey, null);
  }

  async function openSource(documentId: string, lineId: string): Promise<void> {
    if (!services || !active.companyId) return;
    setLoading(true); setError("");
    try {
      setSourceDetail(await services.getDocument(active.companyId, documentId));
      setSourceLineId(lineId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "بازکردن سند مبدأ با خطا مواجه شد.");
    } finally { setLoading(false); }
  }

  if (services && !services.canView) return <Page><Feedback tone="error">برای مشاهده گزارش‌های موجودی مجوز کافی ندارید.</Feedback></Page>;

  return (
    <Page className="inventory-report-page" dir="rtl">
      <header className="inventory-report-page__header">
        <div><h2>گزارش‌های کمّی انبار</h2><p>موجودی و کاردکس بر پایه movementهای قطعی و بدون ارزش‌گذاری ریالی.</p></div>
        <div className="inventory-report-page__tabs" role="tablist" aria-label="نوع گزارش">
          <button type="button" className={tab === "balances" ? "active" : ""} onClick={() => setTab("balances")}>موجودی</button>
          <button type="button" className={tab === "kardex" ? "active" : ""} disabled={!selectedStockKey} onClick={() => setTab("kardex")}>کاردکس</button>
        </div>
      </header>

      {error && <Feedback tone="error">{error}</Feedback>}
      <section className="inventory-report-note" aria-label="توضیح گزارش">
        <strong>قاعده ترتیب:</strong> تاریخ عملیات ← ترتیب روز ← شناسه سند ← شناسه ردیف ← شناسه movement. ثبت دیرتر یک سند با تاریخ قدیمی می‌تواند مانده‌های تاریخی بعد از آن تاریخ را تغییر دهد. «موجودی» در این صفحه فقط On-hand است؛ رزرو، Available-to-Promise و ارزش ریالی در این فاز وجود ندارند.
      </section>

      {tab === "balances" && <>
        <form className="inventory-report-filters" onSubmit={submitBalanceFilters}>
          <label>کالا<select value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">همه کالاها</option>{products.map((p) => <option key={p.productId} value={p.productId}>{p.code} — {p.title}</option>)}</select></label>
          <label>انبار<select value={warehouseId} onChange={(e) => void chooseWarehouse(e.target.value)}><option value="">همه انبارها</option>{warehouses.map((w) => <option key={w.warehouseId} value={w.warehouseId}>{w.code} — {w.title}</option>)}</select></label>
          <label>ناحیه<select value={zoneId} disabled={!warehouseId} onChange={(e) => void chooseZone(e.target.value)}><option value="">همه ناحیه‌ها</option>{zones.map((z) => <option key={z.zoneId} value={z.zoneId}>{z.code} — {z.title}</option>)}</select></label>
          <label>موقعیت<select value={locationId} disabled={!zoneId} onChange={(e) => setLocationId(e.target.value)}><option value="">همه موقعیت‌ها</option>{locations.map((l) => <option key={l.locationId} value={l.locationId}>{l.code} — {l.title}</option>)}</select></label>
          <label className="inventory-report-checkbox"><input type="checkbox" checked={includeZero} onChange={(e) => setIncludeZero(e.target.checked)} /> نمایش موجودی صفر</label>
          <button type="submit" disabled={loading}>اعمال فیلتر</button>
        </form>
        <div className="inventory-report-table-wrap"><table className="inventory-report-table"><thead><tr><th>کالا</th><th>انبار</th><th>ناحیه / موقعیت</th><th>موجودی پایه</th><th>عملیات</th></tr></thead><tbody>
          {balances?.items.map((row) => <tr key={JSON.stringify(row.stockKey)}><td><bdi dir="ltr">{row.productCode}</bdi><span>{row.productTitle}</span></td><td><bdi dir="ltr">{row.warehouseCode}</bdi><span>{row.warehouseTitle}</span></td><td>{row.zoneTitle ?? "—"}{row.locationTitle ? ` / ${row.locationTitle}` : ""}</td><td><bdi dir="ltr">{row.quantity}</bdi></td><td><button type="button" onClick={() => openBalanceKardex(row)}>نمایش کاردکس</button></td></tr>)}
          {!loading && balances?.items.length === 0 && <tr><td colSpan={5}>موردی مطابق فیلتر پیدا نشد.</td></tr>}
        </tbody></table></div>
        <div className="inventory-report-pagination"><button type="button" disabled={!balanceCursorStack.length || loading} onClick={() => { const stack=[...balanceCursorStack]; const previous=stack.pop()??null; setBalanceCursorStack(stack); void loadBalances(previous); }}>قبلی</button><button type="button" disabled={!balances?.nextCursor || loading} onClick={() => { if (!balances?.nextCursor) return; setBalanceCursorStack((s) => [...s, balanceCursor]); void loadBalances(balances.nextCursor); }}>بعدی</button></div>
      </>}

      {tab === "kardex" && selectedStockKey && <>
        <form className="inventory-report-filters inventory-report-filters--kardex" onSubmit={(event) => { event.preventDefault(); setKardexCursorStack([]); void loadKardex(selectedStockKey, null); }}>
          <label>از تاریخ شمسی<input dir="ltr" inputMode="numeric" placeholder="۱۴۰۵/۰۱/۰۱" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
          <label>تا تاریخ شمسی<input dir="ltr" inputMode="numeric" placeholder="۱۴۰۵/۱۲/۲۹" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
          <button type="submit" disabled={loading}>اعمال بازه</button>
        </form>
        {kardex && <div className="inventory-report-summary"><div><span>مانده ابتدای صفحه/بازه</span><strong dir="ltr">{kardex.openingQuantity}</strong></div><div><span>ورودی این صفحه</span><strong dir="ltr">{kardex.incomingQuantity}</strong></div><div><span>خروجی این صفحه</span><strong dir="ltr">{kardex.outgoingQuantity}</strong></div><div><span>مانده انتهای صفحه</span><strong dir="ltr">{kardex.closingQuantity}</strong></div></div>}
        <div className="inventory-report-table-wrap"><table className="inventory-report-table inventory-report-table--kardex"><thead><tr><th>تاریخ</th><th>ترتیب</th><th>سند / ردیف</th><th>ورودی</th><th>خروجی</th><th>مانده</th><th>مبدأ</th></tr></thead><tbody>
          {kardex?.entries.map((entry) => <tr key={entry.movement.movementId}><td>{gregorianToJalali(entry.movement.businessDate)}</td><td dir="ltr">{entry.movement.businessOrder}</td><td><bdi dir="ltr">{entry.source.documentNumber ?? entry.source.documentId}</bdi><small>ردیف {entry.source.linePosition}</small></td><td dir="ltr">{entry.incomingQuantity === "0" ? "—" : entry.incomingQuantity}</td><td dir="ltr">{entry.outgoingQuantity === "0" ? "—" : entry.outgoingQuantity}</td><td dir="ltr">{entry.runningQuantity}</td><td><button type="button" onClick={() => void openSource(entry.source.documentId, entry.source.lineId)}>جزئیات</button>{entry.source.sourceSystem && <small><bdi dir="ltr">{entry.source.sourceSystem}</bdi> / <bdi dir="ltr">{ltr(entry.source.sourceDocumentId)}</bdi></small>}</td></tr>)}
          {!loading && kardex?.entries.length === 0 && <tr><td colSpan={7}>در این بازه movementی وجود ندارد.</td></tr>}
        </tbody></table></div>
        <div className="inventory-report-pagination"><button type="button" disabled={!kardexCursorStack.length || loading} onClick={() => { const stack=[...kardexCursorStack]; const previous=stack.pop()??null; setKardexCursorStack(stack); void loadKardex(selectedStockKey, previous); }}>قبلی</button><button type="button" disabled={!kardex?.nextCursor || loading} onClick={() => { if (!kardex?.nextCursor) return; setKardexCursorStack((s) => [...s, kardexCursor]); void loadKardex(selectedStockKey, kardex.nextCursor); }}>بعدی</button></div>
      </>}

      {sourceDetail && <aside className="inventory-source-drilldown" aria-label="جزئیات سند مبدأ"><header><div><h3>سند مبدأ</h3><bdi dir="ltr">{sourceDetail.document.documentNumber ?? sourceDetail.document.documentId}</bdi></div><button type="button" onClick={() => setSourceDetail(null)}>بستن</button></header><dl><div><dt>نوع</dt><dd>{sourceDetail.document.documentType}</dd></div><div><dt>تاریخ</dt><dd>{gregorianToJalali(sourceDetail.document.businessDate)}</dd></div><div><dt>وضعیت</dt><dd>{sourceDetail.document.status}</dd></div></dl><h4>ردیف اثرگذار</h4>{sourceDetail.document.lines.filter((line) => line.lineId === sourceLineId).map((line) => <div className="inventory-source-line" key={line.lineId}><span>ردیف {line.position}</span><bdi dir="ltr">Product: {line.productId}</bdi><bdi dir="ltr">Quantity: {line.operation?.quantity.enteredQuantity ?? "—"}</bdi><bdi dir="ltr">Line ID: {line.lineId}</bdi></div>)}<p>شناسه‌های بالا durable هستند؛ شماره سند فقط برای نمایش است.</p></aside>}
    </Page>
  );
}
