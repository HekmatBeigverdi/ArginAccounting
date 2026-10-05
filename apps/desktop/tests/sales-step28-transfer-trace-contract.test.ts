import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=(path:string)=>readFile(new URL("../"+path,import.meta.url),"utf8");

test("sales Step 28 keeps import draft-only and replay-safe",async()=>{
 const source=await read("src/features/sales/sales-import-controller.ts");
 assert.match(source,/sales-import:/u);
 assert.match(source,/services\.create/u);
 assert.doesNotMatch(source,/finalize|transition\(/u);
 assert.match(source,/فاکتور فروش/u);
 assert.match(source,/سفارش فروش/u);
});
test("sales Step 28 exposes Excel and RTL A4 print preview",async()=>{
 const source=await read("src/features/sales/sales-export-print.ts");
 assert.match(source,/createInventoryXlsx/u);
 assert.match(source,/dir=\\?"rtl/u);
 assert.match(source,/@page\{size:A4 landscape/u);
 assert.match(source,/چاپ \/ ذخیره PDF/u);
});
test("sales workspace exposes permission-scoped import export and operational trace",async()=>{
 const page=await read("src/pages/sales/sales-documents-page.tsx");
 for(const token of ["salesPermissions.import","salesPermissions.export","salesPermissions.traceView","getOperationalTrace","الگوی ورود","چاپ / PDF","سند انبار مرتبط","ارزش‌گذاری"])assert.match(page,new RegExp(token.replace(".","\\."),"u"));
});
test("sales operational trace follows Sales to Inventory movement to valuation without Accounting",async()=>{
 const source=await read("../../packages/sales-tauri/src/sqlite-sales-operational-trace-reader.ts");
 assert.match(source,/source_system='sales'/u);
 assert.match(source,/inventory_stock_movements/u);
 assert.match(source,/inventory_valuation_entries/u);
 assert.doesNotMatch(source,/journal|accounting/u);
});
