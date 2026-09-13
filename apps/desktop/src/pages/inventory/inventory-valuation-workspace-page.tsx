import { useEffect, useMemo, useState } from "react";
import { getDesktopDatabase } from "@argin/database-tauri";
import type {
  InventoryValuationAsOfReport,
  InventoryValuationLayerReport,
  InventoryValuationMonetaryKardexReport,
  InventoryValuationRecalculationStatusReport,
  InventoryValuationUnresolvedReport,
} from "@argin/inventory/valuation-reports";
import type { InventoryValuationPolicySnapshot } from "@argin/inventory/valuation-policy";
import type { InventoryValuationTraceSnapshot } from "@argin/inventory/valuation-security";
import type { ProductSelectorItemDto } from "@argin/product";
import type { WarehouseListItemDto } from "@argin/warehouse";
import { useActiveContext } from "../../app/providers/active-context-provider";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { Feedback } from "../../components/feedback";
import { Page } from "../../components/layout";
import {
  createInventoryValuationWorkspaceServices,
  type InventoryValuationWorkspaceServices,
} from "../../composition/inventory/create-inventory-valuation-workspace-services";
import { createInventoryValuationTraceService } from "../../composition/inventory/create-inventory-valuation-trace-service";
import { gregorianToJalali, jalaliToGregorian } from "./inventory-persian-date";
import {
  ValuationKardexPanel,
  ValuationLayersPanel,
  ValuationOverviewPanel,
  ValuationPolicyPanel,
  ValuationTracePanel,
  ValuationUnresolvedPanel,
} from "./inventory-valuation-panels";
import "./inventory-valuation-workspace-page.css";

type ValuationTab = "overview" | "kardex" | "layers" | "unresolved" | "policy";

type ValuationTraceReader = (
  companyId: string,
  movementId: string,
) => Promise<InventoryValuationTraceSnapshot | null>;

const VALUATION_TABS = [
  ["overview", "ارزش موجودی"],
  ["kardex", "کاردکس ریالی"],
  ["layers", "لایه‌های FIFO"],
  ["unresolved", "نیازمند بررسی"],
  ["policy", "سیاست ارزش‌گذاری"],
] as const satisfies readonly (readonly [ValuationTab, string])[];

const VALUATION_STATUS_LABELS = {
  current: "به‌روز",
  "attention-required": "نیازمند بررسی",
  empty: "بدون گردش",
} satisfies Record<
  InventoryValuationRecalculationStatusReport["status"],
  string
>;

const todayInJalali = () =>
  gregorianToJalali(new Date().toISOString().slice(0, 10));

export function InventoryValuationWorkspacePage() {
  const activeContext = useActiveContext();
  const { session } = useAuthSession();

  const [services, setServices] =
    useState<InventoryValuationWorkspaceServices | null>(null);
  const [traceReader, setTraceReader] = useState<ValuationTraceReader | null>(
    null,
  );

  const [activeTab, setActiveTab] = useState<ValuationTab>("overview");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [products, setProducts] = useState<readonly ProductSelectorItemDto[]>(
    [],
  );
  const [warehouses, setWarehouses] = useState<readonly WarehouseListItemDto[]>(
    [],
  );
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [asOfDate, setAsOfDate] = useState(todayInJalali());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(todayInJalali());

  const [overview, setOverview] = useState<InventoryValuationAsOfReport | null>(
    null,
  );
  const [kardex, setKardex] =
    useState<InventoryValuationMonetaryKardexReport | null>(null);
  const [layers, setLayers] = useState<InventoryValuationLayerReport | null>(
    null,
  );
  const [unresolved, setUnresolved] =
    useState<InventoryValuationUnresolvedReport | null>(null);
  const [status, setStatus] =
    useState<InventoryValuationRecalculationStatusReport | null>(null);
  const [policies, setPolicies] = useState<
    readonly InventoryValuationPolicySnapshot[]
  >([]);
  const [trace, setTrace] = useState<InventoryValuationTraceSnapshot | null>(
    null,
  );

  const actor = useMemo(
    () => ({
      permissions: session?.user.permissions ?? [],
      branchIds: session?.user.branchIds ?? [],
    }),
    [session],
  );

  useEffect(() => {
    void getDesktopDatabase()
      .then((db) => {
        setServices(
          createInventoryValuationWorkspaceServices(
            db,
            actor.permissions,
            actor.branchIds,
          ),
        );
        setTraceReader(() => createInventoryValuationTraceService(db));
      })
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "راه‌اندازی ارزش‌گذاری ناموفق بود.",
        ),
      );
  }, [actor]);

  useEffect(() => {
    if (!services?.canView || !activeContext.companyId) return;
    void Promise.all([
      services.selectProducts(activeContext.companyId),
      services.selectWarehouses(
        activeContext.companyId,
        activeContext.branchId || null,
      ),
    ])
      .then(([availableProducts, availableWarehouses]) => {
        setProducts(availableProducts);
        setWarehouses(availableWarehouses);
      })
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "بارگذاری انتخابگرها ناموفق بود.",
        ),
      );
  }, [services, activeContext.companyId, activeContext.branchId]);

  async function loadReport(
    nextTab: ValuationTab = activeTab,
    cursor: string | null = null,
  ) {
    if (!services || !activeContext.companyId) return;
    setLoading(true);
    setError("");
    setTrace(null);
    try {
      const companyId = activeContext.companyId;
      const branchId = activeContext.branchId || null;

      if (nextTab === "overview") {
        setOverview(
          await services.readAsOf({
            companyId,
            branchId,
            asOfBusinessDate: jalaliToGregorian(asOfDate),
            productId: productId || null,
            warehouseId: warehouseId || null,
            limit: 100,
          }),
        );
        setStatus(await services.readStatus(companyId, productId || null));
      } else if (nextTab === "kardex") {
        if (!productId || !warehouseId)
          throw new Error("برای کاردکس ریالی، کالا و انبار را انتخاب کنید.");
        setKardex(
          await services.readKardex({
            companyId,
            branchId,
            productId,
            warehouseId,
            businessDateFrom: dateFrom ? jalaliToGregorian(dateFrom) : null,
            businessDateTo: dateTo ? jalaliToGregorian(dateTo) : null,
            cursor,
            limit: 100,
          }),
        );
      } else if (nextTab === "layers") {
        setLayers(
          await services.readLayers({
            companyId,
            branchId,
            productId: productId || null,
            warehouseId: warehouseId || null,
            onlyOpen: true,
            limit: 100,
          }),
        );
      } else if (nextTab === "unresolved") {
        setUnresolved(
          await services.readUnresolved({
            companyId,
            branchId,
            productId: productId || null,
            warehouseId: warehouseId || null,
            fromBusinessDate: dateFrom ? jalaliToGregorian(dateFrom) : null,
            limit: 100,
          }),
        );
      } else {
        setPolicies(await services.getPolicyHistory(companyId));
      }

      setActiveTab(nextTab);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "خواندن ارزش‌گذاری ناموفق بود.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (services?.canView && activeContext.companyId)
      void loadReport("overview");
  }, [services, activeContext.companyId]);

  async function openTrace(movementId: string) {
    if (traceReader && activeContext.companyId)
      setTrace(await traceReader(activeContext.companyId, movementId));
  }

  if (services && !services.canView)
    return (
      <Page>
        <Feedback tone="error">
          برای مشاهده ارزش‌گذاری موجودی مجوز کافی ندارید.
        </Feedback>
      </Page>
    );

  const valuationStatus = status?.status ?? "empty";

  return (
    <Page className="valuation-page" dir="rtl">
      <header className="valuation-head">
        <div>
          <h2>ارزش‌گذاری موجودی</h2>
          <p>
            ارزش ریالی، کاردکس مالی، FIFO، موارد حل‌نشده و تاریخچه سیاست.
          </p>
        </div>
        <div
          className={`valuation-status valuation-status--${valuationStatus}`}
        >
          {VALUATION_STATUS_LABELS[valuationStatus]}
          <small>
            Revision: <bdi>{status?.streamRevision ?? 0}</bdi>
          </small>
        </div>
      </header>
      {error && <Feedback tone="error">{error}</Feedback>}
      <p className="valuation-note">
        <strong>پل آرگین:</strong> Movement، Cost Input و Policy داده اصلی‌اند؛
        جمع گزارش و مانده ریالی خروجی بازسازی‌پذیر هستند.
      </p>
      <div className="valuation-tabs">
        {VALUATION_TABS.map(([tabId, label]) => (
          <button
            key={tabId}
            className={activeTab === tabId ? "active" : ""}
            onClick={() => void loadReport(tabId)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="valuation-filters">
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
        <label>
          انبار
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            <option value="">همه انبارها</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.warehouseId} value={warehouse.warehouseId}>
                {warehouse.code} — {warehouse.title}
              </option>
            ))}
          </select>
        </label>
        {activeTab === "overview" && (
          <label>
            تا تاریخ
            <input
              dir="ltr"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
            />
          </label>
        )}
        {(activeTab === "kardex" || activeTab === "unresolved") && (
          <label>
            از تاریخ
            <input
              dir="ltr"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
        )}
        {activeTab === "kardex" && (
          <label>
            تا تاریخ
            <input
              dir="ltr"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
        )}
        <button disabled={loading} onClick={() => void loadReport()}>
          {loading ? "در حال خواندن…" : "اعمال فیلتر"}
        </button>
      </div>
      {activeTab === "overview" && overview && (
        <ValuationOverviewPanel report={overview} />
      )}{" "}
      {activeTab === "kardex" && kardex && (
        <ValuationKardexPanel
          report={kardex}
          onTrace={(movementId) => void openTrace(movementId)}
          onNext={(cursor) => void loadReport("kardex", cursor)}
        />
      )}{" "}
      {activeTab === "layers" && layers && (
        <ValuationLayersPanel report={layers} />
      )}{" "}
      {activeTab === "unresolved" && unresolved && (
        <ValuationUnresolvedPanel report={unresolved} />
      )}{" "}
      {activeTab === "policy" && (
        <ValuationPolicyPanel
          rows={policies}
          readOnly={!services?.canManagePolicy}
        />
      )}{" "}
      {trace && (
        <ValuationTracePanel trace={trace} onClose={() => setTrace(null)} />
      )}
    </Page>
  );
}
