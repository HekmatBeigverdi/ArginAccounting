import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseExecuteResult, DatabaseExecutor, DatabaseSession, DatabaseValue } from "@argin/database";
import { SqliteInventoryValuationReportReader } from "../src/index.ts";

class StubDatabase implements DatabaseExecutor {
  readonly calls: Array<{ kind:"query"|"queryOne"; sql:string; parameters:readonly DatabaseValue[] }> = [];
  readonly queryResults: unknown[][] = [];
  readonly oneResults: unknown[] = [];
  async execute(): Promise<DatabaseExecuteResult> { return { rowsAffected: 0 }; }
  async query<T>(sql:string,parameters:readonly DatabaseValue[]=[]):Promise<T[]> { this.calls.push({kind:"query",sql,parameters}); return (this.queryResults.shift() ?? []) as T[]; }
  async queryOne<T>(sql:string,parameters:readonly DatabaseValue[]=[]):Promise<T|null> { this.calls.push({kind:"queryOne",sql,parameters}); return (this.oneResults.shift() ?? null) as T|null; }
  async transaction<T>(operation:(transaction:DatabaseSession)=>Promise<T>):Promise<T> { return operation(this); }
  async close():Promise<void> {}
}

test("valuation reports reject unbounded limits", async () => {
  const db=new StubDatabase();
  const reader=new SqliteInventoryValuationReportReader(db);
  await assert.rejects(
    reader.readAsOf({companyId:"c1",asOfBusinessDate:"2026-09-13",limit:501}),
    /VALUATION_REPORT_INPUT_INVALID:limit/u,
  );
  assert.equal(db.calls.length,0);
});

test("as-of report returns latest persisted valuation states and resolved total", async () => {
  const db=new StubDatabase();
  db.queryResults.push([
    {product_id:"p1",warehouse_id:"w1",zone_key:"",location_key:"",business_date:"2026-09-10",policy_id:"pol1",method:"fifo",strategy_version:1,currency:"IRR",quantity:"4",total_cost:400,unresolved_count:0},
    {product_id:"p2",warehouse_id:"w1",zone_key:"z1",location_key:"l1",business_date:"2026-09-11",policy_id:"pol1",method:"fifo",strategy_version:1,currency:"IRR",quantity:"2",total_cost:null,unresolved_count:1},
  ]);
  const report=await new SqliteInventoryValuationReportReader(db).readAsOf({companyId:"c1",asOfBusinessDate:"2026-09-12",limit:10});
  assert.equal(report.resolvedTotalCost,400);
  assert.equal(report.unresolvedRowCount,1);
  assert.equal(report.rows[0]?.zoneId,null);
  assert.equal(report.rows[1]?.locationId,"l1");
  assert.match(db.calls[0]?.sql ?? "",/ROW_NUMBER\(\) OVER/u);
  assert.match(db.calls[0]?.sql ?? "",/business_date<=\?/u);
});

test("monetary kardex computes running resolved cost and emits canonical next cursor", async () => {
  const db=new StubDatabase();
  db.oneResults.push({ok:1});
  db.queryResults.push([
    {valuation_entry_id:"v1",movement_id:"m1",document_id:"d1",line_id:"l1",product_id:"p1",warehouse_id:"w1",business_date:"2026-09-10",business_order:1,kind:"inbound",method:"fifo",currency:"IRR",quantity:"3",unit_cost:"100",total_cost:300,cost_state:"resolved",unresolved_reason:null},
    {valuation_entry_id:"v2",movement_id:"m2",document_id:"d2",line_id:"l2",product_id:"p1",warehouse_id:"w1",business_date:"2026-09-11",business_order:2,kind:"outbound",method:"fifo",currency:"IRR",quantity:"1",unit_cost:null,total_cost:null,cost_state:"unresolved",unresolved_reason:"insufficient_cost_basis"},
  ]);
  const report=await new SqliteInventoryValuationReportReader(db).readMonetaryKardex({companyId:"c1",productId:"p1",warehouseId:"w1",limit:1});
  assert.equal(report.openingResolvedCost,0);
  assert.equal(report.entries[0]?.runningResolvedCost,300);
  assert.equal(report.closingResolvedCost,300);
  assert.ok(report.nextCursor);
  const decoded=JSON.parse(decodeURIComponent(report.nextCursor!));
  assert.deepEqual(decoded,{businessDate:"2026-09-10",businessOrder:1,documentId:"d1",lineId:"l1",movementId:"m1"});
});

test("layer report defaults to current open FIFO layers only", async () => {
  const db=new StubDatabase(); db.queryResults.push([]);
  await new SqliteInventoryValuationReportReader(db).readLayers({companyId:"c1",limit:50});
  assert.match(db.calls[0]?.sql ?? "",/remaining_quantity<>'0'/u);
});

test("recalculation status requires attention for unresolved or missing movement valuation", async () => {
  const db=new StubDatabase();
  db.oneResults.push(
    {d:"2026-09-13"},
    {d:"2026-09-12"},
    {n:1},
    {n:2},
    {revision:7},
  );
  const report=await new SqliteInventoryValuationReportReader(db).readRecalculationStatus({companyId:"c1",productId:"p1"});
  assert.equal(report.status,"attention-required");
  assert.equal(report.unresolvedCount,3);
  assert.equal(report.streamRevision,7);
  assert.equal(report.latestMovementBusinessDate,"2026-09-13");
});
