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
import type { InventoryInboundCostCandidate } from "@argin/inventory-tauri";
import type { ProductSelectorItemDto } from "@argin/product";
import type { WarehouseListItemDto } from "@argin/warehouse";
import { useActiveContext } from "../../app/providers/active-context-provider";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { Feedback } from "../../components/feedback";
import { PersianDatePicker } from "../../components/forms";
import { Page } from "../../components/layout";
import {
  createInventoryValuationWorkspaceServices,
  type InventoryResolvedInboundCostDisplay,
  type InventoryValuationWorkspaceServices,
} from "../../composition/inventory/create-inventory-valuation-workspace-services";
import { createInventoryValuationTraceService } from "../../composition/inventory/create-inventory-valuation-trace-service";
import {
  ValuationInboundCostPanel,
  ValuationKardexPanel,
  ValuationLayersPanel,
  ValuationOverviewPanel,
  ValuationPolicyPanel,
  ValuationRegisteredCostPanel,
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
} satisfies Record<InventoryValuationRecalculationStatusReport["status"], string>;

const todayIso = () => new Date().toISOString().slice(0, 10);

export function InventoryValuationWorkspacePage() {
  const activeContext = useActiveContext();
  const { session } = useAuthSession();

  const [services, setServices] = useState<InventoryValuationWorkspaceServices | null>(null);
  const [traceReader, setTraceReader] = useState<ValuationTraceReader | null>(null);
  const [activeTab, setActiveTab] = useState<ValuationTab>("overview");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingCost, setSavingCost] = useState(false);

  const [products, setProducts] = useState<readonly ProductSelectorItemDto[]>([]);
  const [warehouses, setWarehouses] = useState<readonly WarehouseListItemDto[]>([]);
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [asOfDate, setAsOfDate] = useState(todayIso());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(todayIso());

  const [overview, setOverview] = useState<InventoryValuationAsOfReport | null>(null);
  const [kardex, setKardex] = useState<InventoryValuationMonetaryKardexReport | null>(null);
  const [layers, setLayers] = useState<InventoryValuationLayerReport | null>(null);
  const [unresolved, setUnresolved] = useState<InventoryValuationUnresolvedReport | null>(null);
  const [inboundCostCandidates, setInboundCostCandidates] = useState<readonly InventoryInboundCostCandidate[]>([]);
  const [resolvedInboundCosts, setResolvedInboundCosts] = useState<readonly InventoryResolvedInboundCostDisplay[]>([]);
  const [status, setStatus] = useState<InventoryValuationRecalculationStatusReport | null>(null);
  const [policies, setPolicies] = useState<readonly InventoryValuationPolicySnapshot[]>([]);
  const [trace, setTrace] = useState<InventoryValuationTraceSnapshot | null>(null);

  const actor = useMemo(
    () => ({
      id: session?.user.id ?? "desktop-local-user",
      permissions: session?.user.permissions ?? [],
      branchIds: session?.user.branchIds ?? [],
    }),
    [session],
  );

  useEffect(() => {
    void getDesktopDatabase()
      .then((db) => {
        setServices(createInventoryValuationWorkspaceServices(db, actor.permissions, actor.branchIds));
        setTraceReader(() => createInventoryValuationTraceService(db));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "راه‌اندازی ارزش‌گذاری ناموفق بود."));
  }, [actor]);

  useEffect(() => {
    if (!services?.canView || !activeContext.companyId) return;
    void Promise.all([
      services.selectProducts(activeContext.companyId),
      services.selectWarehouses(activeContext.companyId, activeContext.branchId || null),
    ])
      .then(([availableProducts, availableWarehouses]) => {
        setProducts(availableProducts);
        setWarehouses(availableWarehouses);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "بارگذاری انتخابگرها ناموفق بود."));
  }, [services, activeContext.companyId, activeContext.branchId]);

  function valuationQuery() {
    return {
      companyId: activeContext.companyId!,
      branchId: activeContext.branchId || null,
      productId: productId || null,
      warehouseId: warehouseId || null,
      fromBusinessDate: dateFrom || null,
      limit: 100,
    };
  }

  async function refreshUnresolvedWorkspace() {
    if (!services || !activeContext.companyId) return;
    const query = valuationQuery();
    const [unresolvedReport, candidates, registered, nextStatus] = await Promise.all([
      services.readUnresolved(query),
      services.readInboundCostCandidates(query),
      services.readResolvedInboundCosts(query),
      services.readStatus(activeContext.companyId, productId || null),
    ]);
    setUnresolved(unresolvedReport);
    setInboundCostCandidates(candidates);
    setResolvedInboundCosts(registered);
    setStatus(nextStatus);
  }

  async function loadReport(nextTab: ValuationTab = activeTab, cursor: string | null = null) {
    if (!services || !activeContext.companyId) return;
    setLoading(true);
    setError("");
    setSuccess("");
    setTrace(null);
    try {
      const companyId = activeContext.companyId;
      const branchId = activeContext.branchId || null;
      if (nextTab === "overview") {
        setOverview(await services.readAsOf({companyId,branchId,asOfBusinessDate:asOfDate,productId:productId || null,warehouseId:warehouseId || null,limit:100}));
        setStatus(await services.readStatus(companyId, productId || null));
      } else if (nextTab === "kardex") {
        if (!productId || !warehouseId) throw new Error("برای کاردکس ریالی، کالا و انبار را انتخاب کنید.");
        setKardex(await services.readKardex({companyId,branchId,productId,warehouseId,businessDateFrom:dateFrom || null,businessDateTo:dateTo || null,cursor,limit:100}));
      } else if (nextTab === "layers") {
        setLayers(await services.readLayers({companyId,branchId,productId:productId || null,warehouseId:warehouseId || null,onlyOpen:true,limit:100}));
      } else if (nextTab === "unresolved") {
        await refreshUnresolvedWorkspace();
      } else {
        setPolicies(await services.getPolicyHistory(companyId));
      }
      setActiveTab(nextTab);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خواندن ارزش‌گذاری ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (services?.canView && activeContext.companyId) void loadReport("overview");
  }, [services, activeContext.companyId]);

  async function openTrace(movementId: string) {
    if (traceReader && activeContext.companyId) setTrace(await traceReader(activeContext.companyId, movementId));
  }

  async function setInboundCost(row: InventoryInboundCostCandidate, unitCost: string) {
    if (!services || !activeContext.companyId) return;
    setSavingCost(true);
    setError("");
    setSuccess("");
    try {
      const result = await services.setManualInboundCost({
        companyId: activeContext.companyId,
        movementId: row.movementId,
        unitCost,
        actorId: actor.id,
        requestId: crypto.randomUUID(),
        occurredAt: new Date().toISOString(),
      });
      const amount = new Intl.NumberFormat("fa-IR").format(result.totalCost);
      setSuccess(result.valuationCreated
        ? `بهای خرید/ورودی ثبت و ارزش‌گذاری شد: ${amount} ${result.currency}`
        : `بهای خرید/ورودی ثبت شد: ${amount} ${result.currency}. برای ایجاد ارزش‌گذاری، سیاست مؤثر را تعیین کنید.`);
      await refreshUnresolvedWorkspace();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت بهای ورودی ناموفق بود.");
      throw e;
    } finally {
      setSavingCost(false);
    }
  }

  async function correctInboundCost(row: InventoryResolvedInboundCostDisplay, unitCost: string, reason: string) {
    if (!services || !activeContext.companyId) return;
    setSavingCost(true);
    setError("");
    setSuccess("");
    try {
      const result = await services.correctManualInboundCost({
        companyId: activeContext.companyId,
        movementId: row.movementId,
        unitCost,
        reason,
        expectedRevision: row.revision,
        actorId: actor.id,
        requestId: crypto.randomUUID(),
        occurredAt: new Date().toISOString(),
      });
      const amount = new Intl.NumberFormat("fa-IR").format(result.totalCost);
      setSuccess(`بهای خرید/ورودی اصلاح شد: ${amount} ${result.currency}`);
      await refreshUnresolvedWorkspace();
    } catch (e) {
      const message = e instanceof Error ? e.message : "اصلاح بهای ورودی ناموفق بود.";
      setError(message === "VALUATION_COST_INPUT_CORRECTION_RECALCULATION_REQUIRED"
        ? "برای این ردیف ارزش‌گذاری ایجاد شده است؛ اصلاح بها باید از مسیر محاسبه مجدد کنترل‌شده انجام شود."
        : message);
      throw e;
    } finally {
      setSavingCost(false);
    }
  }

  if (services && !services.canView) {
    return <Page><Feedback tone="error">برای مشاهده ارزش‌گذاری موجودی مجوز کافی ندارید.</Feedback></Page>;
  }

  const valuationStatus = status?.status ?? "empty";
  return (
    <Page className="valuation-page" dir="rtl">
      <header className="valuation-head">
        <div><h2>ارزش‌گذاری موجودی</h2><p>ارزش ریالی، کاردکس مالی، FIFO، موارد حل‌نشده و تاریخچه سیاست.</p></div>
        <div className={`valuation-status valuation-status--${valuationStatus}`}>
          {VALUATION_STATUS_LABELS[valuationStatus]}
          <small>Revision: <bdi>{status?.streamRevision ?? 0}</bdi></small>
        </div>
      </header>

      {error && <Feedback tone="error">{error}</Feedback>}
      {success && <Feedback tone="success">{success}</Feedback>}

      <p className="valuation-note"><strong>پل آرگین:</strong> Movement، Cost Input و Policy داده اصلی‌اند؛ جمع گزارش و مانده ریالی خروجی بازسازی‌پذیر هستند.</p>

      <div className="valuation-tabs">
        {VALUATION_TABS.map(([tabId, label]) => <button key={tabId} className={activeTab === tabId ? "active" : ""} onClick={() => void loadReport(tabId)}>{label}</button>)}
      </div>

      <div className="valuation-filters">
        <label>کالا<select value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">همه کالاها</option>{products.map((product) => <option key={product.productId} value={product.productId}>{product.code} — {product.title}</option>)}</select></label>
        <label>انبار<select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}><option value="">همه انبارها</option>{warehouses.map((warehouse) => <option key={warehouse.warehouseId} value={warehouse.warehouseId}>{warehouse.code} — {warehouse.title}</option>)}</select></label>
        {activeTab === "overview" && <label>تا تاریخ<PersianDatePicker value={asOfDate} onChange={setAsOfDate} ariaLabel="تا تاریخ ارزش‌گذاری" /></label>}
        {(activeTab === "kardex" || activeTab === "unresolved") && <label>از تاریخ<PersianDatePicker value={dateFrom} onChange={setDateFrom} ariaLabel="از تاریخ ارزش‌گذاری" /></label>}
        {activeTab === "kardex" && <label>تا تاریخ<PersianDatePicker value={dateTo} onChange={setDateTo} ariaLabel="تا تاریخ کاردکس ریالی" /></label>}
        <button disabled={loading} onClick={() => void loadReport()}>{loading ? "در حال خواندن…" : "اعمال فیلتر"}</button>
      </div>

      {activeTab === "overview" && overview && <ValuationOverviewPanel report={overview} />}
      {activeTab === "kardex" && kardex && <ValuationKardexPanel report={kardex} onTrace={(movementId) => void openTrace(movementId)} onNext={(cursor) => void loadReport("kardex", cursor)} />}
      {activeTab === "layers" && layers && <ValuationLayersPanel report={layers} />}
      {activeTab === "unresolved" && <>
        <ValuationInboundCostPanel rows={inboundCostCandidates} canResolve={services?.canResolveCostInput ?? false} saving={savingCost} onSetCost={setInboundCost} />
        <ValuationRegisteredCostPanel rows={resolvedInboundCosts} canCorrect={services?.canCorrectCostInput ?? false} saving={savingCost} onCorrectCost={correctInboundCost} />
        {unresolved && <ValuationUnresolvedPanel report={unresolved} />}
      </>}
      {activeTab === "policy" && <ValuationPolicyPanel rows={policies} readOnly={!services?.canManagePolicy} />}
      {trace && <ValuationTracePanel trace={trace} onClose={() => setTrace(null)} />}
    </Page>
  );
}