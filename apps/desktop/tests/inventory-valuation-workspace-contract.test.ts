import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");
const readWorkspace=()=>read("src/pages/inventory/inventory-valuation-workspace-page.tsx");

test("valuation workspace is routed and permission-gated",async()=>{
  const [router,nav]=await Promise.all([read("src/app/router/app-router.tsx"),read("src/app/navigation/navigation-items.ts")]);
  assert.match(router,/\/inventory\/valuation/);
  assert.match(router,/InventoryValuationWorkspacePage/);
  assert.match(nav,/ارزش‌گذاری موجودی/);
  assert.match(nav,/inventory\.valuation\.view/);
});

test("valuation workspace exposes Persian RTL report surfaces",async()=>{
  const page=await readWorkspace();
  for(const text of ["ارزش موجودی","کاردکس ریالی","لایه‌های FIFO","نیازمند بررسی","سیاست ارزش‌گذاری"]){assert.match(page,new RegExp(text));}
  assert.match(page,/dir="rtl"/);
  assert.match(page,/PersianDatePicker/);
});

test("valuation workspace explains Bridge authority and FIFO current-layer semantics",async()=>{
  const [page,panels]=await Promise.all([readWorkspace(),read("src/pages/inventory/inventory-valuation-panels.tsx")]);
  assert.match(page,/Movement، Cost Input و Policy داده اصلی‌اند/);
  assert.match(panels,/لایه‌های باز فعلی FIFO/);
  assert.match(panels,/گزارش تاریخی As-of نیست/);
});

test("valuation overview explains why an empty filtered result is not a zero inventory value",async()=>{
  const panels=await read("src/pages/inventory/inventory-valuation-panels.tsx");
  assert.match(panels,/برای فیلتر انتخاب‌شده هنوز خروجی ارزش‌گذاری تولید نشده است/u);
  assert.match(panels,/Revision/u);
  assert.match(panels,/سیاست ارزش‌گذاری شرکت/u);
  assert.match(panels,/صفر بودن واقعی ارزش موجودی نیست/u);
});

test("valuation calendar can escape the filter card and overlay following report content",async()=>{
  const css=await read("src/pages/inventory/inventory-valuation-workspace-page.css");
  assert.match(css,/\.valuation-page[\s\S]*overflow: visible/u);
  assert.match(css,/\.valuation-filters[\s\S]*position: relative/u);
  assert.match(css,/\.valuation-filters[\s\S]*overflow: visible/u);
  assert.match(css,/\.valuation-page \.ui-persian-date__popover \{ z-index: 1500; \}/u);
});

test("valuation workspace provides provenance drill-down",async()=>{
  const [page,trace]=await Promise.all([readWorkspace(),read("src/composition/inventory/create-inventory-valuation-trace-service.ts")]);
  assert.match(page,/ValuationTracePanel/);
  assert.match(trace,/createInventoryValuationTraceSnapshot/);
  assert.match(trace,/costInput/);
});

test("confirmed inbound movements without upstream cost can use the manual exception path",async()=>{
  const [page,panels,composition]=await Promise.all([
    readWorkspace(),
    read("src/pages/inventory/inventory-valuation-panels.tsx"),
    read("src/composition/inventory/create-inventory-valuation-workspace-services.ts"),
  ]);
  assert.match(page,/readInboundCostCandidates/);
  assert.match(page,/setManualInboundCost/);
  assert.match(panels,/رفع استثناهای بهای ورودی/);
  assert.match(panels,/فاکتور خرید/);
  assert.match(panels,/رفع بهای ورودی نامشخص/);
  assert.match(composition,/inventoryValuationPermissions\.resolve/);
});

test("manual inbound cost modal is viewport safe and uses document date as valuation basis",async()=>{
  const [panels,css]=await Promise.all([
    read("src/pages/inventory/inventory-valuation-panels.tsx"),
    read("src/pages/inventory/inventory-valuation-workspace-page.css"),
  ]);
  assert.match(panels,/import \{ Dialog \} from "\.\.\/\.\.\/components\/feedback"/u);
  assert.match(panels,/title="رفع بهای ورودی نامشخص"/u);
  assert.match(panels,/تاریخ مبنا همان تاریخ قطعی سند انبار است/u);
  assert.match(panels,/تاریخ سند/u);
  assert.doesNotMatch(panels,/تاریخ بهای ورودی/u);
  assert.match(css,/width: min\(46rem, calc\(100vw - 40px\)\)/u);
  assert.match(css,/grid-template-rows: auto minmax\(0, 1fr\) auto/u);
  assert.match(css,/\.valuation-page \.ui-dialog__body/u);
});

test("truncated business labels expose the full readable label on hover",async()=>{
  const [panels,css]=await Promise.all([
    read("src/pages/inventory/inventory-valuation-panels.tsx"),
    read("src/pages/inventory/inventory-valuation-workspace-page.css"),
  ]);
  assert.match(panels,/title=\{label\}/u);
  assert.match(panels,/aria-label=\{label\}/u);
  assert.match(css,/text-overflow: ellipsis/u);
  assert.match(css,/cursor: help/u);
});

test("registered inbound costs are reviewable and historical correction requires a reason",async()=>{
  const [page,panels,composition]=await Promise.all([
    readWorkspace(),
    read("src/pages/inventory/inventory-valuation-panels.tsx"),
    read("src/composition/inventory/create-inventory-valuation-workspace-services.ts"),
  ]);
  assert.match(page,/readResolvedInboundCosts/u);
  assert.match(page,/correctManualInboundCost/u);
  assert.match(panels,/بهای ورودی ثبت‌شده — کنترل و ردیابی/u);
  assert.match(panels,/اصلاح تاریخی/u);
  assert.match(panels,/دلیل اصلاح/u);
  assert.match(composition,/inventoryValuationPermissions\.costInputCorrect/u);
});

test("valuation unresolved rows use readable business labels instead of raw UUIDs",async()=>{
  const [panels,composition,css]=await Promise.all([
    read("src/pages/inventory/inventory-valuation-panels.tsx"),
    read("src/composition/inventory/create-inventory-valuation-workspace-services.ts"),
    read("src/pages/inventory/inventory-valuation-workspace-page.css"),
  ]);
  assert.match(composition,/documentLabel/);
  assert.match(composition,/productLabel/);
  assert.match(composition,/warehouseLabel/);
  assert.match(composition,/document_number/);
  assert.match(composition,/SELECT id,code,title FROM products/);
  assert.match(composition,/SELECT id,code,title FROM warehouses/);
  assert.match(panels,/valuation-readable/);
  assert.match(css,/min-width: 0/);
  assert.match(css,/overflow-x: auto/);
});

test("confirmed inventory documents trigger monetary valuation immediately",async()=>{
  const composition=await read("src/composition/inventory/create-inventory-workspace-services.ts");
  assert.match(composition,/SqliteInventoryValuationLiveService/u);
  assert.match(composition,/const valuationLive = new SqliteInventoryValuationLiveService\(database\)/u);
  assert.match(
    composition,
    /await secured\.confirm[\s\S]*await valuationLive\.catchUpCompany\(document\.companyId, occurredAt\)/u,
  );
});

test("valuation overview and FIFO layers render product and warehouse names instead of UUIDs",async()=>{
  const page=await readWorkspace();
  assert.match(page,/const productNames = useMemo/u);
  assert.match(page,/product\.productId, product\.title/u);
  assert.match(page,/const warehouseNames = useMemo/u);
  assert.match(page,/warehouse\.warehouseId, warehouse\.title/u);
  assert.match(page,/productId: productNames\.get\(row\.productId\) \?\? row\.productId/u);
  assert.match(page,/warehouseId: warehouseNames\.get\(row\.warehouseId\) \?\? row\.warehouseId/u);
  assert.match(page,/ValuationOverviewPanel report=\{overviewDisplay\}/u);
  assert.match(page,/ValuationLayersPanel report=\{layersDisplay\}/u);
});

test("inventory valuation source references use canonical filenames",async()=>{
  const inventoryTauriIndex=await readFile(new URL("../../../packages/inventory-tauri/src/index.ts",import.meta.url),"utf8");
  assert.doesNotMatch(inventoryTauriIndex,/inbound-cost-input-service-v\d+/u);
});
