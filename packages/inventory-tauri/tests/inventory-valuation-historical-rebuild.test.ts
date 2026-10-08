import assert from "node:assert/strict";
import test from "node:test";

import {
  SqliteInventoryValuationHistoricalRebuildService,
} from "../src/index.ts";

test("historical rebuild bridges remaining MWA state into FIFO at policy transition", async () => {
  const movements = [
    {
      movement_id:"m-in",company_id:"c1",document_id:"d1",line_id:"l1",
      transfer_id:null,reversal_of_movement_id:null,product_id:"p1",
      warehouse_id:"w1",zone_id:null,location_id:null,
      business_date:"2026-01-01",business_order:1,
      recorded_at:"2026-01-01T10:00:00.000Z",quantity_delta:"10",
    },
    {
      movement_id:"m-mwa-out",company_id:"c1",document_id:"d2",line_id:"l2",
      transfer_id:null,reversal_of_movement_id:null,product_id:"p1",
      warehouse_id:"w1",zone_id:null,location_id:null,
      business_date:"2026-02-01",business_order:2,
      recorded_at:"2026-02-01T10:00:00.000Z",quantity_delta:"-2",
    },
    {
      movement_id:"m-fifo-out",company_id:"c1",document_id:"d3",line_id:"l3",
      transfer_id:null,reversal_of_movement_id:null,product_id:"p1",
      warehouse_id:"w1",zone_id:null,location_id:null,
      business_date:"2027-01-02",business_order:3,
      recorded_at:"2027-01-02T10:00:00.000Z",quantity_delta:"-3",
    },
  ];
  const policies = [
    {
      policy_id:"policy-mwa",method:"moving_average",strategy_version:1,
      currency:"IRR",effective_from:"2026-01-01",revision:1,
    },
    {
      policy_id:"policy-fifo",method:"fifo",strategy_version:1,
      currency:"IRR",effective_from:"2027-01-01",revision:2,
    },
  ];
  const costInputs = [{
    movement_id:"m-in",quantity:"10",currency:"IRR",
    total_cost:1000,unit_cost:"100",
  }];

  const writes:Array<{sql:string;params:readonly unknown[]}> = [];
  const session = {
    async queryOne(sql:string) {
      if (sql.includes("inventory_valuation_idempotency")) return null;
      throw new Error("unexpected queryOne: "+sql);
    },
    async execute(sql:string,params:readonly unknown[]=[]){
      writes.push({sql,params});
      return { rowsAffected:1 };
    },
  };
  const db = {
    async query(sql:string){
      if (sql.includes("FROM inventory_all_stock_movements")) return movements;
      if (sql.includes("FROM inventory_valuation_policies")) return policies;
      if (sql.includes("FROM inventory_valuation_cost_inputs")) return costInputs;
      throw new Error("unexpected query: "+sql);
    },
    async transaction(work:(value:any)=>Promise<any>){
      return work(session);
    },
  };

  const service = new SqliteInventoryValuationHistoricalRebuildService(db as any);
  const result = await service.rebuildProduct({
    companyId:"c1",
    productId:"p1",
    actorId:"u1",
    requestId:"rebuild-1",
    occurredAt:"2027-01-03T10:00:00.000Z",
  });

  assert.equal(result.rebuiltMovementCount,3);

  const transitionWrite = writes.find(
    (write) =>
      write.sql.includes("INSERT INTO inventory_valuation_cost_layers")
      && String(write.params[0]).startsWith("fifo-transition:policy-fifo:"),
  );
  assert.ok(transitionWrite, "expected an MWA -> FIFO transition layer");
  assert.equal(transitionWrite.params[13], "8");
  assert.equal(transitionWrite.params[14], "5");
  assert.equal(transitionWrite.params[16], 800);
  assert.equal(transitionWrite.params[17], 500);

  const fifoOutbound = writes.find(
    (write) =>
      write.sql.includes("INSERT INTO inventory_valuation_entries")
      && write.params[3] === "m-fifo-out",
  );
  assert.ok(fifoOutbound, "expected FIFO outbound valuation to be rebuilt");
  assert.equal(fifoOutbound.params[18], "100");
  assert.equal(fifoOutbound.params[19], -300);
});
