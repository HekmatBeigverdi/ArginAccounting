import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=(path:string)=>readFile(new URL("../"+path,import.meta.url),"utf8");
const mutationBody=(source:string)=>source.slice(source.indexOf("return database.transaction"));

test("Phase 24 finalize stays atomic from replay through numbering, persistence and Inventory staging",async()=>{
 const source=mutationBody(await read("src/composition/sales/mutate-sales-document.ts"));
 const order=["decideSalesReplay","assertSalesExpectedVersion","BelowCostSalesGuardService","generateDocumentNumber(fiscalUow","await documents.update(after","stageFinalizedSalesIssue","stageFinalizedSalesReturnReceipt","idempotency.add"];
 let cursor=-1;for(const token of order){const next=source.indexOf(token);assert.ok(next>cursor,token+" must remain after the previous finalization gate");cursor=next;}
 assert.match(source,/return database\.transaction\(async session/u);
});

test("failed finalize cannot persist an official number outside the transaction",async()=>{
 const source=await read("src/composition/sales/mutate-sales-document.ts");
 assert.doesNotMatch(source,/database\.execute[\s\S]{0,160}document_number/u);
 assert.match(source,/SqliteFiscalUnitOfWork\.fromSession\(session\)/u);
 assert.match(source,/await documents\.update\(after/u);
});

test("Sales Invoice and Sales Return stage opposite Inventory drafts only after finalize",async()=>{
 const source=await read("src/composition/sales/mutate-sales-document.ts");
 assert.match(source,/document\.documentType !== "sales-invoice"/u);
 assert.match(source,/documentType: "issue"/u);
 assert.match(source,/document\.documentType !== "sales-return"/u);
 assert.match(source,/documentType: "receipt"/u);
 assert.match(source,/if \(action === "finalize" && transition\)/u);
});

test("Phase 24 operational chain stops at valuation and never owns Accounting posting",async()=>{
 const trace=await read("../../packages/sales-tauri/src/sqlite-sales-operational-trace-reader.ts");
 assert.match(trace,/inventory_documents/u);assert.match(trace,/inventory_stock_movements/u);assert.match(trace,/inventory_valuation_entries/u);
 assert.doesNotMatch(trace,/journal_vouchers|journal_lines|posting_rules/u);
 const mutation=await read("src/composition/sales/mutate-sales-document.ts");
 assert.doesNotMatch(mutation,/JournalVoucher|postingRule|journal_vouchers/u);
});

test("below-cost guard blocks unavailable cost and requires explicit warning or approval handling",async()=>{
 const source=await read("src/composition/sales/mutate-sales-document.ts");
 for(const token of ['outcomes.includes("cost-unavailable")','outcomes.includes("blocked")','outcomes.includes("warning")','outcomes.includes("approval-required")'])assert.match(source,new RegExp(token.replace(/[()]/g,"\\$&"),"u"));
 assert.match(source,/belowCostApprovalReason\?\.trim/u);
});

test("optimistic concurrency and idempotent replay remain first-class mutation gates",async()=>{
 const source=mutationBody(await read("src/composition/sales/mutate-sales-document.ts"));
 assert.match(source,/decideSalesReplay/u);assert.match(source,/assertSalesExpectedVersion/u);assert.match(source,/createSalesIdempotencyRecord/u);
 assert.ok(source.indexOf("decideSalesReplay")<source.indexOf("assertSalesExpectedVersion"));
});

test("bulk import cannot bypass lifecycle finalization, numbering or Inventory",async()=>{
 const source=await read("src/features/sales/sales-import-controller.ts");
 assert.match(source,/services\.create/u);assert.match(source,/sales-import:/u);
 assert.doesNotMatch(source,/finalize|generateDocumentNumber|stageFinalizedSalesIssue|InventoryDraftService/u);
});

test("Sales schema enforces unique official number in its business scope",async()=>{
 const migration=await read("src-tauri/migrations/0035_sales_workflow.sql");
 assert.match(migration,/CREATE UNIQUE INDEX ux_sales_documents_number/u);
 assert.match(migration,/company_id,fiscal_year_id,branch_id,document_type,document_number/u);
 assert.match(migration,/WHERE document_number IS NOT NULL/u);
});

test("Step 28 output uses persisted commercial facts and explicit RTL print direction",async()=>{
 const source=await read("src/features/sales/sales-export-print.ts");
 assert.match(source,/calculateSalesLineTotals/u);assert.match(source,/dir=\\?"rtl/u);assert.match(source,/@page\{size:A4 landscape/u);
 assert.doesNotMatch(source,/priceList|resolvePrice/u);
});
