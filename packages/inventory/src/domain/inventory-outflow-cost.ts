import type { CurrencyCode } from "@argin/platform";
import type { InventoryStockMovementSnapshot } from "./inventory-stock.ts";
import {
  resolveInventoryValuationPolicy,
  type InventoryValuationPolicySnapshot,
} from "./inventory-valuation-policy.ts";
import {
  fifoInventoryValuationStrategy,
  movingAverageInventoryValuationStrategy,
  type InventoryFifoConsumption,
  type InventoryFifoState,
  type InventoryMovingAverageState,
} from "./inventory-valuation-strategy.ts";
import type {
  InventoryCostAmount,
  InventoryUnitCostAmount,
  InventoryValuationMethod,
} from "./inventory-valuation.ts";

export type InventoryOutflowCostErrorCode =
  | "OUTFLOW_COST_INPUT_INVALID"
  | "OUTFLOW_COST_MOVEMENT_NOT_OUTBOUND"
  | "OUTFLOW_COST_TRANSFER_DEFERRED"
  | "OUTFLOW_COST_REVERSAL_DEFERRED"
  | "OUTFLOW_COST_STATE_REQUIRED"
  | "OUTFLOW_COST_STATE_METHOD_MISMATCH";

export class InventoryOutflowCostError extends Error {
  constructor(
    public readonly code: InventoryOutflowCostErrorCode,
    public readonly field: string,
  ) {
    super(`${code}:${field}`);
    this.name = "InventoryOutflowCostError";
  }
}

export interface InventoryOutflowCostBaseResult {
  readonly movementId: string;
  readonly documentId: string;
  readonly lineId: string;
  readonly companyId: string;
  readonly productId: string;
  readonly warehouseId: string;
  readonly businessDate: string;
  readonly businessOrder: number;
  readonly policyId: string;
  readonly method: InventoryValuationMethod;
  readonly strategyVersion: number;
  readonly currency: CurrencyCode;
  readonly quantity: string;
  readonly unitCost: InventoryUnitCostAmount;
  /** Signed monetary effect: ordinary outflow is always negative. */
  readonly totalCost: InventoryCostAmount;
}

export interface InventoryFifoOutflowCostResult extends InventoryOutflowCostBaseResult {
  readonly method: "fifo";
  readonly nextState: InventoryFifoState;
  readonly consumptions: readonly InventoryFifoConsumption[];
}

export interface InventoryMovingAverageOutflowCostResult extends InventoryOutflowCostBaseResult {
  readonly method: "moving_average";
  readonly nextState: InventoryMovingAverageState;
  readonly consumptions: readonly [];
}

export type InventoryOutflowCostResult =
  | InventoryFifoOutflowCostResult
  | InventoryMovingAverageOutflowCostResult;

export type InventoryOutflowValuationState =
  | { readonly method: "fifo"; readonly state: InventoryFifoState }
  | { readonly method: "moving_average"; readonly state: InventoryMovingAverageState };

function fail(code: InventoryOutflowCostErrorCode, field: string): never {
  throw new InventoryOutflowCostError(code, field);
}

function assertOrdinaryOutboundMovement(movement: InventoryStockMovementSnapshot): void {
  if (!movement || typeof movement !== "object") return fail("OUTFLOW_COST_INPUT_INVALID", "movement");
  if (movement.transferId) return fail("OUTFLOW_COST_TRANSFER_DEFERRED", "movement.transferId");
  if (movement.reversalOfMovementId) return fail("OUTFLOW_COST_REVERSAL_DEFERRED", "movement.reversalOfMovementId");
  if (typeof movement.quantityDelta !== "string" || !movement.quantityDelta.startsWith("-")) {
    return fail("OUTFLOW_COST_MOVEMENT_NOT_OUTBOUND", "movement.quantityDelta");
  }
}

function absoluteOutboundQuantity(quantityDelta: string): string {
  const quantity = quantityDelta.slice(1);
  if (!quantity || quantity === "0") return fail("OUTFLOW_COST_MOVEMENT_NOT_OUTBOUND", "movement.quantityDelta");
  return quantity;
}

export function calculateInventoryOutflowCost(input: {
  readonly movement: InventoryStockMovementSnapshot;
  readonly policies: readonly InventoryValuationPolicySnapshot[];
  readonly valuationState: InventoryOutflowValuationState;
}): InventoryOutflowCostResult {
  if (!input || typeof input !== "object") return fail("OUTFLOW_COST_INPUT_INVALID", "input");
  assertOrdinaryOutboundMovement(input.movement);
  if (!input.valuationState || typeof input.valuationState !== "object") {
    return fail("OUTFLOW_COST_STATE_REQUIRED", "valuationState");
  }

  const movement = input.movement;
  const resolution = resolveInventoryValuationPolicy(input.policies, {
    companyId: movement.companyId,
    productId: movement.stockKey.productId,
    warehouseId: movement.stockKey.warehouseId,
    businessDate: movement.businessDate,
  });
  const policy = resolution.policy;

  if (input.valuationState.method !== policy.method) {
    return fail("OUTFLOW_COST_STATE_METHOD_MISMATCH", "valuationState.method");
  }

  const quantity = absoluteOutboundQuantity(movement.quantityDelta);
  const base = {
    movementId: movement.movementId,
    documentId: movement.documentId,
    lineId: movement.lineId,
    companyId: movement.companyId,
    productId: movement.stockKey.productId,
    warehouseId: movement.stockKey.warehouseId,
    businessDate: movement.businessDate,
    businessOrder: movement.businessOrder,
    policyId: policy.policyId,
    strategyVersion: policy.strategyVersion,
    currency: policy.currency,
    quantity,
  } as const;

  if (policy.method === "fifo") {
    if (input.valuationState.method !== "fifo") {
      return fail("OUTFLOW_COST_STATE_METHOD_MISMATCH", "valuationState.method");
    }
    const strategyResult = fifoInventoryValuationStrategy.issue(input.valuationState.state, {
      quantity,
      currency: policy.currency,
    });
    return Object.freeze({
      ...base,
      method: "fifo" as const,
      unitCost: strategyResult.unitCost,
      totalCost: strategyResult.totalCost,
      nextState: strategyResult.state,
      consumptions: strategyResult.consumptions,
    });
  }

  if (input.valuationState.method !== "moving_average") {
    return fail("OUTFLOW_COST_STATE_METHOD_MISMATCH", "valuationState.method");
  }
  const strategyResult = movingAverageInventoryValuationStrategy.issue(input.valuationState.state, {
    quantity,
    currency: policy.currency,
  });
  return Object.freeze({
    ...base,
    method: "moving_average" as const,
    unitCost: strategyResult.unitCost,
    totalCost: strategyResult.totalCost,
    nextState: strategyResult.state,
    consumptions: Object.freeze([] as const),
  });
}
