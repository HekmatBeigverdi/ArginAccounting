import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Sales migration defines workflow, lifecycle and replay persistence",async()=>{
  const sql=await readFile(new URL("../src-tauri/migrations/0035_sales_workflow.sql",import.meta.url),"utf8");
  for(const table of ["sales_documents","sales_document_lifecycle","sales_idempotency"]){
    assert.match(sql,new RegExp(`CREATE TABLE ${table}\\b`,"u"));
  }
  assert.match(sql,/UNIQUE \(company_id,operation_id\)/u);
  assert.match(sql,/document_json TEXT NOT NULL CHECK \(json_valid\(document_json\)\)/u);
  assert.match(sql,/result_json TEXT NOT NULL CHECK \(json_valid\(result_json\)\)/u);
});

test("desktop registers migration 35",async()=>{
  const source=await readFile(new URL("../src-tauri/src/lib.rs",import.meta.url),"utf8");
  assert.match(source,/version: 35, description: "sales_workflow"/u);
  assert.match(source,/0035_sales_workflow\.sql/u);
});
