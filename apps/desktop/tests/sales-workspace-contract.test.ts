import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=(p:string)=>readFile(new URL("../"+p,import.meta.url),"utf8");

test("Sales workspace is registered in permission-scoped navigation and router",async()=>{
 const [router,nav]=await Promise.all([read("src/app/router/app-router.tsx"),read("src/app/navigation/navigation-items.ts")]);
 assert.match(router,/SalesDocumentsPage/u);assert.match(router,/path="\/sales\/documents"/u);
 assert.match(nav,/label: "اسناد فروش"/u);assert.match(nav,/group: "فروش"/u);assert.match(nav,/requiredPermission: "sales\.documents\.view"/u);
});

test("Sales workspace is Persian RTL with desktop inner-scroll layout",async()=>{
 const [page,css]=await Promise.all([read("src/pages/sales/sales-documents-page.tsx"),read("src/pages/sales/sales-documents-page.css")]);
 assert.match(page,/className="sales-workspace" dir="rtl"/u);assert.match(page,/fa-IR-u-ca-persian/u);
 assert.match(page,/سفارش فروش/u);assert.match(page,/فاکتور فروش/u);assert.match(page,/برگشت از فروش/u);assert.match(page,/اصلاح فروش/u);
 assert.match(css,/height:calc\(100vh - 150px\)/u);assert.match(css,/overflow:hidden/u);assert.match(css,/\.sales-list__scroll,.sales-detail\{overflow:auto/u);
});

test("Sales workspace exposes lifecycle and permission-aware actions",async()=>{
 const page=await read("src/pages/sales/sales-documents-page.tsx");
 for(const permission of ["create","edit","submit","approve","finalize","cancel"])assert.match(page,new RegExp(`salesPermissions\\.${permission}`,"u"));
 for(const label of ["ارسال برای تأیید","تأیید","قطعی‌کردن","لغو"])assert.match(page,new RegExp(label,"u"));
});

test("Sales detail keeps commercial and durable lineage visible",async()=>{
 const page=await read("src/pages/sales/sales-documents-page.tsx");
 for(const value of ["قیمت واحد","تخفیف","مالیات","جمع فروش","شناسه پایدار سند","سند مرتبط","منبع سند"])assert.match(page,new RegExp(value,"u"));
 assert.match(page,/commercialTerms/u);assert.match(page,/relatedDocumentReference/u);assert.match(page,/sourceReference/u);
});

test("Desktop declares Sales core and SQLite adapter dependencies",async()=>{
 const pkg=JSON.parse(await read("package.json")) as {dependencies:Record<string,string>};
 assert.equal(pkg.dependencies["@argin/sales"],"workspace:*");assert.equal(pkg.dependencies["@argin/sales-tauri"],"workspace:*");
});
