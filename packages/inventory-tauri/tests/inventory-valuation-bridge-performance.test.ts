import assert from "node:assert/strict";
import test from "node:test";
import { createInventoryValuationCostInputSyncEnvelope } from "@argin/inventory/valuation-sync";
import { applyMigrations, openTestSqlite } from "./sqlite-test-support.ts";

test("persisted authoritative Cost Input round-trips through the Bridge envelope without monetary drift", async () => {
  const db = await openTestSqlite();
  try {
    await applyMigrations(db,29);
    db.prepare(`INSERT INTO inventory_valuation_cost_inputs(
      basis_line_id,company_id,movement_id,product_id,warehouse_id,quantity,currency,
      base_cost,landed_cost,total_cost,unit_cost,allocations_json,revision)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run("basis-1","company-e","movement-e","product-e","warehouse-e","2.5","IRR",250,25,275,"110","[]",3);
    const row = db.prepare(`SELECT basis_line_id,movement_id,product_id,warehouse_id,quantity,currency,
      base_cost,landed_cost,total_cost,unit_cost,allocations_json,revision
      FROM inventory_valuation_cost_inputs WHERE company_id=? AND movement_id=?`)
      .get("company-e","movement-e") as {
        basis_line_id:string; movement_id:string; product_id:string; warehouse_id:string;
        quantity:string; currency:string; base_cost:number; landed_cost:number;
        total_cost:number; unit_cost:string; allocations_json:string; revision:number;
      };
    const envelope = createInventoryValuationCostInputSyncEnvelope({
      companyId:"company-e",revision:row.revision,operationId:"op-e",requestId:"req-e",
      idempotencyKey:"company-e:req-e",payloadFingerprint:"fp-e",
      changedAt:"2026-09-13T20:00:00+03:30",
      origin:{sourceSystem:"desktop",sourceInstanceId:"desktop-e"},
      streamKey:`valuation:company-e:${row.product_id}`,streamRevision:7,
      snapshot:{
        basisLineId:row.basis_line_id,movementId:row.movement_id,productId:row.product_id,
        warehouseId:row.warehouse_id,quantity:row.quantity,currency:row.currency,
        baseCost:row.base_cost,landedCost:row.landed_cost,totalCost:row.total_cost,
        unitCost:row.unit_cost,allocations:JSON.parse(row.allocations_json) as [],
      },
    });
    const roundTrip = JSON.parse(JSON.stringify(envelope)) as typeof envelope;
    assert.deepEqual(roundTrip,envelope);
    assert.deepEqual(roundTrip.dependencies,[{entity:"inventory-movement",id:"movement-e"}]);
    assert.equal(roundTrip.snapshot.totalCost,275);
    assert.equal(roundTrip.snapshot.unitCost,"110");
    assert.equal(roundTrip.revision,3);
    assert.equal(roundTrip.streamRevision,7);
  } finally { db.close(); }
});

test("representative-scale valuation lookup stays indexed with ten thousand entries", async () => {
  const db = await openTestSqlite();
  try {
    await applyMigrations(db,29);
    db.exec("BEGIN IMMEDIATE");
    const insert = db.prepare(`INSERT INTO inventory_valuation_entries(
      valuation_entry_id,company_id,product_id,movement_id,document_id,line_id,kind,method,
      strategy_version,currency,warehouse_id,business_date,business_order,quantity,
      unit_cost,total_cost,cost_state,valued_at,revision)
      VALUES(?,?,?,?,?,?,'inbound','fifo',1,'IRR','warehouse-scale',?,?,'1','100',100,'resolved','2026-09-13T00:00:00.000Z',1)`);
    for (let index=0; index<10_000; index+=1) {
      const product=`product-${String(index%100).padStart(3,"0")}`;
      const day=String((index%28)+1).padStart(2,"0");
      insert.run(`entry-${index}`,"company-scale",product,`movement-${index}`,
        `document-${Math.floor(index/5)}`,`line-${index}`,`2026-09-${day}`,index+1);
    }
    db.exec("COMMIT");
    const rows=db.prepare(`SELECT valuation_entry_id FROM inventory_valuation_entries
      WHERE company_id=? AND product_id=?
      ORDER BY business_date,business_order,document_id,line_id,movement_id LIMIT 100`)
      .all("company-scale","product-042");
    assert.equal(rows.length,100);
    const plan=db.prepare(`EXPLAIN QUERY PLAN SELECT valuation_entry_id FROM inventory_valuation_entries
      WHERE company_id=? AND product_id=?
      ORDER BY business_date,business_order,document_id,line_id,movement_id LIMIT 100`)
      .all("company-scale","product-042") as Array<{detail:string}>;
    assert.ok(plan.some((row)=>row.detail.includes("idx_inventory_valuation_entries_company_product_chronology")));
  } finally { db.close(); }
});
