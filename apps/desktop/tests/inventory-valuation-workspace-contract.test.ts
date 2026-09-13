import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");
const readWorkspace=()=>read("src/pages/inventory/inventory-valuation-workspace-page-v2.tsx");

test("valuation workspace is routed and permission-gated",async()=>{
  const [router,nav,page]=await Promise.all([read("src/app/router/app-router.tsx"),read("src/app/navigation/navigation-items.ts"),read("src/pages/inventory/inventory-valuation-workspace-page.tsx")]);
  assert.match(router,/\/inventory\/valuation/);
  assert.match(router,/InventoryValuationWorkspacePage/);
  assert.match(nav,/ارزش‌گذاری موجودی/);
  assert.match(nav,/inventory\.valuation\.view/);
  assert.match(page,/inventory-valuation-workspace-page-v2/);
});

test("valuation workspace exposes Persian RTL report surfaces",async()=>{
  const page=await readWorkspace();
  for(const text of ["ارزش موجودی","کاردکس ریالی","لایه‌های FIFO","نیازمند بررسی","سیاست ارزش‌گذاری"]){assert.match(page,new RegExp(text));}
  assert.match(page,/dir="rtl"/);
  assert.match(page,/jalaliToGregorian/);
});

test("valuation workspace explains Bridge authority and FIFO current-layer semantics",async()=>{
  const [page,panels]=await Promise.all([readWorkspace(),read("src/pages/inventory/inventory-valuation-panels.tsx")]);
  assert.match(page,/Movement، Cost Input و Policy داده اصلی‌اند/);
  assert.match(panels,/لایه‌های باز فعلی FIFO/);
  assert.match(panels,/گزارش تاریخی As-of نیست/);
});

test("valuation workspace provides provenance drill-down",async()=>{
  const [page,trace]=await Promise.all([readWorkspace(),read("src/composition/inventory/create-inventory-valuation-trace-service.ts")]);
  assert.match(page,/ValuationTracePanel/);
  assert.match(trace,/createInventoryValuationTraceSnapshot/);
  assert.match(trace,/costInput/);
});

test("confirmed old and new inbound movements can receive manual cost",async()=>{
  const [page,panels,composition]=await Promise.all([
    readWorkspace(),
    read("src/pages/inventory/inventory-valuation-panels.tsx"),
    read("src/composition/inventory/create-inventory-valuation-workspace-services.ts"),
  ]);
  assert.match(page,/readInboundCostCandidates/);
  assert.match(page,/setManualInboundCost/);
  assert.match(panels,/ورودی‌های قطعی‌شده با بهای تعیین‌نشده/);
  assert.match(panels,/رسیدهای قدیمی و جدید هر دو قابل قیمت‌گذاری هستند/);
  assert.match(panels,/تعیین بهای ورودی/);
  assert.match(composition,/inventoryValuationPermissions\.resolve/);
});
