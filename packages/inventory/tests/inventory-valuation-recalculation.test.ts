import assert from "node:assert/strict";
import test from "node:test";
import {
  createInventoryValuationRecalculationPlan,
  replayInventoryValuationPlan,
} from "../src/domain/inventory-valuation-recalculation.ts";
import type { InventoryStockMovementSnapshot } from "../src/domain/inventory-stock.ts";

function movement(input: { id:string; productId?:string; warehouseId?:string; date:string; order:number; documentId?:string; lineId?:string }): InventoryStockMovementSnapshot {
  return Object.freeze({ movementId:input.id, companyId:"c1", documentId:input.documentId ?? `d-${input.id}`, lineId:input.lineId ?? `l-${input.id}`,
    businessDate:input.date, businessOrder:input.order, recordedAt:"2026-09-12T08:00:00.000Z",
    stockKey:Object.freeze({ companyId:"c1", productId:input.productId ?? "p1", warehouseId:input.warehouseId ?? "w1", zoneId:null, locationId:null }),
    transferId:null, reversalOfMovementId:null, quantityDelta:"1" });
}

const movements = [
  movement({ id:"m3", date:"2026-01-03", order:3, warehouseId:"w2" }),
  movement({ id:"m1", date:"2026-01-01", order:1 }),
  movement({ id:"m2", date:"2026-01-02", order:2 }),
  movement({ id:"other", productId:"p2", date:"2026-01-02", order:2 }),
];

test("backdated movement recalculates same Company+Product across warehouses from exact point", () => {
  const plan = createInventoryValuationRecalculationPlan({ movements, trigger:{ reason:"backdated_movement", movement:movements[2]! }});
  assert.deepEqual(plan.movementIds,["m2","m3"]);
  assert.equal(plan.productId,"p1");
});

test("reversal starts conservatively at original chronology point", () => {
  const samePointA = movement({ id:"a", date:"2026-02-01", order:5, documentId:"a-doc" });
  const samePointB = movement({ id:"b", date:"2026-02-01", order:5, documentId:"b-doc" });
  const plan = createInventoryValuationRecalculationPlan({ movements:[samePointB,samePointA], trigger:{ reason:"reversal", companyId:"c1", productId:"p1", originalBusinessDate:"2026-02-01", originalBusinessOrder:5 }});
  assert.deepEqual(plan.movementIds,["a","b"]);
});

test("Company policy change affects every Product from effective date", () => {
  const plan = createInventoryValuationRecalculationPlan({ movements, trigger:{ reason:"policy_changed", companyId:"c1", effectiveFrom:"2026-01-02" }});
  assert.equal(plan.productId,null);
  assert.deepEqual(plan.movementIds,["m2","other","m3"]);
});

test("canonical replay is deterministic even when source facts arrive unordered", () => {
  const plan = createInventoryValuationRecalculationPlan({ movements, trigger:{ reason:"policy_changed", companyId:"c1", effectiveFrom:"2026-01-01" }});
  const replay = replayInventoryValuationPlan({ plan, seedState:"", apply:(state,m)=>({ state:`${state}${m.movementId}|`, result:m.movementId }) });
  assert.equal(replay.finalState,"m1|m2|other|m3|");
  assert.deepEqual(replay.steps.map((step)=>step.movementId),["m1","m2","other","m3"]);
});

test("cost-basis change excludes earlier unaffected valuation facts", () => {
  const trigger = movement({ id:"changed", date:"2026-03-02", order:2 });
  const earlier = movement({ id:"earlier", date:"2026-03-01", order:1 });
  const later = movement({ id:"later", date:"2026-03-03", order:3 });
  const plan = createInventoryValuationRecalculationPlan({ movements:[later,earlier,trigger], trigger:{ reason:"cost_basis_changed", movement:trigger }});
  assert.deepEqual(plan.movementIds,["changed","later"]);
});
