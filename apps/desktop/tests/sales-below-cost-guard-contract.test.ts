import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=(path:string)=>readFile(new URL("../"+path,import.meta.url),"utf8");

test("below-cost migration persists versioned company policy and auditable decisions",async()=>{
  const sql=await read("src-tauri/migrations/0036_sales_below_cost_guard.sql");
  assert.match(sql,/CREATE TABLE IF NOT EXISTS sales_below_cost_policies/u);
  assert.match(sql,/UNIQUE \(company_id, revision\)/u);
  assert.match(sql,/allow','warn','require-approval','block/u);
  assert.match(sql,/minimum_margin_basis_points/u);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS sales_below_cost_decisions/u);
  for(const field of ["policy_revision","quoted_unit_cost","margin_basis_points","valuation_basis_revision","approved_by","approval_reason"]){
    assert.match(sql,new RegExp(field,"u"));
  }
});

test("desktop registers migration 36",async()=>{
  const lib=await read("src-tauri/src/lib.rs");
  assert.match(lib,/version: 36, description: "sales_below_cost_guard"/u);
  assert.match(lib,/0036_sales_below_cost_guard\.sql/u);
});

test("finalize path enforces guard and stages Inventory documents inside mutation transaction",async()=>{
  const source=await read("src/composition/sales/mutate-sales-document.ts");
  assert.match(source,/BelowCostSalesGuardService/u);
  assert.match(source,/cost-unavailable/u);
  assert.match(source,/acknowledgeBelowCostWarning/u);
  assert.match(source,/approveBelowCost/u);
  assert.match(source,/stageFinalizedSalesIssue/u);
  assert.match(source,/InventorySalesIssueGateway/u);
  assert.match(source,/requestKey: "sales-issue:" \+ document\.documentId/u);
  assert.match(source,/stageFinalizedSalesReturnReceipt/u);
  assert.match(source,/InventorySalesReturnReceiptGateway/u);
  assert.match(source,/requestKey: "sales-return-receipt:" \+ document\.documentId/u);
});

test("Sales UI exposes policy management, warehouse routing and explicit below-cost acknowledgement",async()=>{
  const [page,finalize,policy]=await Promise.all([
    read("src/pages/sales/sales-documents-page.tsx"),
    read("src/pages/sales/sales-finalize-dialog.tsx"),
    read("src/pages/sales/sales-below-cost-policy-dialog.tsx"),
  ]);
  assert.match(page,/سیاست فروش زیر بها/u);
  assert.match(page,/salesPermissions\.manageBelowCostPolicy/u);
  assert.match(page,/SalesFinalizeDialog/u);
  assert.match(finalize,/انبار خروج/u);
  assert.match(finalize,/هشدار فروش زیر حد مجاز را مشاهده کردم/u);
  assert.match(finalize,/canApproveBelowCost/u);
  assert.match(policy,/require-approval/u);
  assert.match(policy,/حداقل حاشیه سود/u);
});
