import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=(path:string)=>readFile(new URL("../"+path,import.meta.url),"utf8");

test("sales finalize allocates official number inside the existing mutation transaction",async()=>{
 const source=await read("src/composition/sales/mutate-sales-document.ts");
 assert.match(source,/return database\.transaction\(async session/u);
 assert.match(source,/if \(action === "finalize"\)/u);
 assert.match(source,/ensureSalesNumberSeries\(session/u);
 assert.match(source,/SqliteFiscalUnitOfWork\.fromSession\(session\)/u);
 assert.match(source,/generateDocumentNumber/u);
 assert.match(source,/document = Object\.freeze\(\{ \.\.\.document, documentNumber \}\)/u);
 assert.ok(source.indexOf("decideSalesReplay")<source.indexOf("generateDocumentNumber(fiscalUow"),"replay must be decided before number reservation");
 assert.ok(source.indexOf("generateDocumentNumber(fiscalUow")<source.indexOf("await documents.update(after"),"number must be reserved before persisted final state");
});
test("sales NumberSeries is scoped by company branch fiscal year and document type",async()=>{
 const source=await read("../../packages/sales-tauri/src/ensure-sales-number-series.ts");
 for(const token of ["company_id","branch_id","fiscal_year_id","entity_type"])assert.match(source,new RegExp(token,"u"));
 for(const prefix of ["SI-","SO-","SR-","SC-"])assert.match(source,new RegExp(prefix,"u"));
});
test("sales list no longer labels a pending number as missing",async()=>{
 const source=await read("src/pages/sales/sales-documents-page.tsx");
 assert.match(source,/در انتظار شماره قطعی/u);
 assert.doesNotMatch(source,/بدون شماره/u);
});
