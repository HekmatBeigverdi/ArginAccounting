import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("policy tab exposes initial company policy setup and deterministic backfill",async()=>{
  const [page,setup]=await Promise.all([
    read("src/pages/inventory/inventory-valuation-workspace-page.tsx"),
    read("src/pages/inventory/inventory-valuation-policy-setup.tsx"),
  ]);
  assert.match(page,/InventoryValuationPolicySetup/u);
  assert.match(page,/policies\.length === 0/u);
  assert.match(setup,/SqliteInventoryValuationBootstrapService/u);
  assert.match(setup,/FIFO — اولین وارده، اولین صادره/u);
  assert.match(setup,/میانگین موزون متحرک/u);
  assert.match(setup,/تاریخ شروع سیاست/u);
  assert.match(setup,/ثبت سیاست و بازسازی ارزش‌گذاری/u);
});

test("bootstrap excludes full reversal pairs and requires cost for active inbound movements",async()=>{
  const source=await readFile(new URL("../../../packages/inventory-tauri/src/sqlite-inventory-valuation-bootstrap-service.ts",import.meta.url),"utf8");
  assert.match(source,/reversal_of_movement_id/u);
  assert.match(source,/reversedOriginals/u);
  assert.match(source,/!m\.reversal_of_movement_id && !reversedOriginals\.has/u);
  assert.match(source,/VALUATION_BOOTSTRAP_UNRESOLVED_COST/u);
  assert.match(source,/inventory_valuation_cost_inputs/u);
});

test("bootstrap produces policy entries layers states and stream revisions",async()=>{
  const source=await readFile(new URL("../../../packages/inventory-tauri/src/sqlite-inventory-valuation-bootstrap-service.ts",import.meta.url),"utf8");
  assert.match(source,/inventory_valuation_policies/u);
  assert.match(source,/inventory_valuation_entries/u);
  assert.match(source,/inventory_valuation_cost_layers/u);
  assert.match(source,/inventory_valuation_states/u);
  assert.match(source,/inventory_valuation_stream_versions/u);
  assert.match(source,/inventory_valuation_idempotency/u);
});
