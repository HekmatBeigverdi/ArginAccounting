import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { DatabaseExecuteResult, DatabaseSession, DatabaseValue } from "@argin/database";
import {
  SqliteInventoryValuationEntryRepository,
  SqliteInventoryValuationPolicyRepository,
  SqliteInventoryValuationStateRepository,
} from "../src/index.ts";

class StubSession implements DatabaseSession {
  readonly calls: Array<{sql:string; parameters:readonly DatabaseValue[]}> = [];
  constructor(private readonly one:unknown=null, private readonly many:unknown[]=[]){ }
  async execute(sql:string,parameters:readonly DatabaseValue[]=[]):Promise<DatabaseExecuteResult>{ this.calls.push({sql,parameters}); return {rowsAffected:1,lastInsertId:null}; }
  async query<T>(sql:string,parameters:readonly DatabaseValue[]=[]):Promise<T[]>{ this.calls.push({sql,parameters}); return this.many as T[]; }
  async queryOne<T>(sql:string,parameters:readonly DatabaseValue[]=[]):Promise<T|null>{ this.calls.push({sql,parameters}); return this.one as T|null; }
}

test("migration 0028 defines durable valuation persistence and indexes", async () => {
  const url = new URL("../../../apps/desktop/src-tauri/migrations/0028_inventory_valuation.sql", import.meta.url);
  const sql = await readFile(url, "utf8");
  for (const table of [
    "inventory_valuation_policies",
    "inventory_valuation_cost_inputs",
    "inventory_valuation_entries",
    "inventory_valuation_cost_layers",
    "inventory_valuation_states",
  ]) assert.match(sql, new RegExp(`CREATE TABLE ${table}`, "u"));
  assert.match(sql, /UNIQUE \(company_id, effective_from\)/u);
  assert.match(sql, /idx_inventory_valuation_entries_company_product_chronology/u);
  assert.match(sql, /idx_inventory_valuation_entries_unresolved/u);
  assert.match(sql, /ON DELETE CASCADE/u);
  assert.match(sql, /tr_inventory_valuation_policies_no_update/u);
  assert.match(sql, /tr_inventory_valuation_policies_no_delete/u);
});

test("policy repository hydrates durable company policy", async () => {
  const db = new StubSession({
    policy_id:"p1", company_id:"c1", method:"fifo", strategy_version:1, currency:"IRR",
    effective_from:"2026-01-01", previous_policy_id:null, change_reason:null, revision:1,
  });
  const repository = new SqliteInventoryValuationPolicyRepository(db);
  const policy = await repository.findCurrent("c1");
  assert.equal(policy?.policyId,"p1");
  assert.equal(policy?.method,"fifo");
  assert.match(db.calls[0]?.sql ?? "", /ORDER BY effective_from DESC/u);
});

test("valuation entry repository maps unresolved rows without fabricating cost", async () => {
  const db = new StubSession({
    valuation_entry_id:"v1", company_id:"c1", product_id:"prod", movement_id:"m1", document_id:"d1", line_id:"l1",
    reversal_of_movement_id:null, transfer_id:null, kind:"inbound", method:"fifo", strategy_version:1, currency:"IRR",
    warehouse_id:"w1", zone_id:null, location_id:null, business_date:"2026-09-12", business_order:10,
    quantity:"3", unit_cost:null, total_cost:null, cost_state:"unresolved", unresolved_reason:"missing_inbound_cost",
    valued_at:null, revision:1,
  });
  const entry = await new SqliteInventoryValuationEntryRepository(db).findByMovement("c1","m1");
  assert.equal(entry?.costState,"unresolved");
  assert.equal(entry?.unitCost,null);
  assert.equal(entry?.totalCost,null);
  assert.equal(entry?.unresolvedReason,"missing_inbound_cost");
});

test("valuation state repository uses canonical null location keys in SQLite", async () => {
  const db = new StubSession();
  const repository = new SqliteInventoryValuationStateRepository(db);
  await repository.get({companyId:"c1",productId:"p1",warehouseId:"w1",zoneId:null,locationId:null,businessDate:"2026-09-12"});
  assert.deepEqual(db.calls[0]?.parameters,["c1","p1","w1","","","2026-09-12"]);
});
