import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateNegativeInventoryAdjustmentValuation,
  calculatePositiveInventoryAdjustmentValuation,
  createInventoryReversalValuation,
} from "../src/domain/inventory-adjustment-reversal-valuation.ts";
import { createInitialInventoryValuationPolicy } from "../src/domain/inventory-valuation-policy.ts";
import type { InventoryResolvedInboundCostBasis } from "../src/domain/inventory-inbound-cost.ts";
import type { InventoryStockMovementSnapshot } from "../src/domain/inventory-stock.ts";

const fifo = createInitialInventoryValuationPolicy({ policyId: "p-fifo", companyId: "c1", method: "fifo", effectiveFrom: "2026-01-01" });
const mwa = createInitialInventoryValuationPolicy({ policyId: "p-mwa", companyId: "c1", method: "moving_average", effectiveFrom: "2026-01-01" });
function mv(id:string, q:string, reversalOfMovementId:string|null=null): InventoryStockMovementSnapshot {
  return Object.freeze({ movementId:id, companyId:"c1", documentId:"d1", lineId:"l1", businessDate:"2026-09-12", businessOrder:10,
    recordedAt:"2026-09-12T08:00:00.000Z", stockKey:Object.freeze({ companyId:"c1", productId:"p1", warehouseId:"w1", zoneId:null, locationId:null }),
    transferId:null, reversalOfMovementId, quantityDelta:q });
}
function basis(movementId:string, quantity:string, totalCost:number, unitCost:string): InventoryResolvedInboundCostBasis {
  return Object.freeze({ basisLineId:`b-${movementId}`, movementId, productId:"p1", warehouseId:"w1", quantity, currency:"IRR", baseCost:totalCost,
    landedCost:0, totalCost, unitCost, allocations:Object.freeze([]) });
}

test("positive FIFO adjustment preserves exact authoritative total cost", () => {
  const r = calculatePositiveInventoryAdjustmentValuation({ movement:mv("m1","3"), policies:[fifo], currentState:{ method:"fifo", state:{ layers:[] }}, costBasis:basis("m1","3",10,"3.333333333333"), layerId:"layer-1" });
  assert.equal(r.totalCost,10); assert.equal(r.createdLayer?.remainingCost,10);
});

test("negative moving average adjustment consumes current pool", () => {
  const r = calculateNegativeInventoryAdjustmentValuation({ movement:mv("m2","-4"), policies:[mwa], currentState:{ method:"moving_average", state:{ quantity:"20", totalCost:3000, currency:"IRR" }}});
  assert.equal(r.totalCost,-600); assert.deepEqual(r.nextState,{ method:"moving_average", state:{ quantity:"16", totalCost:2400, currency:"IRR" }});
});

test("reversal compensates the original valuation fact, not current policy", () => {
  const r = createInventoryReversalValuation({ reversalMovement:mv("r1","4","orig"), original:{ movementId:"orig", companyId:"c1", productId:"p1", warehouseId:"w1", policyId:"historic-mwa", method:"moving_average", strategyVersion:1, currency:"IRR", businessDate:"2026-01-10", businessOrder:2, quantity:"4", totalCost:-600 }});
  assert.equal(r.totalCost,600); assert.equal(r.policyId,"historic-mwa"); assert.equal(r.requiresRecalculation,true);
});
