import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("valuation workspace is routed and permission-gated",async()=>{
  const [router,nav]=await Promise.all([read("src/app/router/app-router.tsx"),read("src/app/navigation/navigation-items.ts")]);
  assert.match(router,/\/inventory\/valuation/);
  assert.match(router,/InventoryValuationWorkspacePage/);
  assert.match(nav,/ارزش‌گذاری موجودی/);
  assert.match(nav,/inventory\.valuation\.view/);
});

test("valuation workspace exposes Persian RTL report surfaces",async()=>{
  const page=await read("src/pages/inventory/inventory-valuation-workspace-page.tsx");
  for(const text of ["ارزش موجودی","کاردکس ریالی","لایه‌های FIFO","نیازمند بررسی","سیاست ارزش‌گذاری"]){assert.match(page,new RegExp(text));}
  assert.match(page,/dir="rtl"/);
  assert.match(page,/jalaliToGregorian/);
});

test("valuation workspace explains Bridge authority and FIFO current-layer semantics",async()=>{
  const [page,panels]=await Promise.all([read("src/pages/inventory/inventory-valuation-workspace-page.tsx"),read("src/pages/inventory/inventory-valuation-panels.tsx")]);
  assert.match(page,/Movement، Cost Input و Policy داده اصلی‌اند/);
  assert.match(panels,/لایه‌های باز فعلی FIFO/);
  assert.match(panels,/گزارش تاریخی As-of نیست/);
});

test("valuation workspace provides provenance drill-down",async()=>{
  const [page,trace]=await Promise.all([read("src/pages/inventory/inventory-valuation-workspace-page.tsx"),read("src/composition/inventory/create-inventory-valuation-trace-service.ts")]);
  assert.match(page,/ValuationTracePanel/);
  assert.match(trace,/createInventoryValuationTraceSnapshot/);
  assert.match(trace,/costInput/);
});
