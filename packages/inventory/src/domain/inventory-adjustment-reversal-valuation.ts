import type { CurrencyCode } from "@argin/platform";
import type { InventoryResolvedInboundCostBasis } from "./inventory-inbound-cost.ts";
import { addInventoryStockQuantities, type InventoryStockMovementSnapshot } from "./inventory-stock.ts";
import { resolveInventoryValuationPolicy, type InventoryValuationPolicySnapshot } from "./inventory-valuation-policy.ts";
import {
  fifoInventoryValuationStrategy,
  movingAverageInventoryValuationStrategy,
  type InventoryFifoConsumption,
  type InventoryFifoLayerState,
  type InventoryFifoState,
  type InventoryMovingAverageState,
} from "./inventory-valuation-strategy.ts";
import type { InventoryCostAmount, InventoryUnitCostAmount, InventoryValuationMethod } from "./inventory-valuation.ts";

export type InventoryAdjustmentReversalErrorCode =
  | "ADJUSTMENT_VALUATION_INPUT_INVALID"
  | "ADJUSTMENT_VALUATION_MOVEMENT_INVALID"
  | "ADJUSTMENT_VALUATION_STATE_METHOD_MISMATCH"
  | "ADJUSTMENT_VALUATION_CURRENCY_MISMATCH"
  | "ADJUSTMENT_VALUATION_BASIS_MISMATCH"
  | "ADJUSTMENT_VALUATION_LAYER_ID_INVALID"
  | "REVERSAL_VALUATION_LINK_INVALID"
  | "REVERSAL_VALUATION_AMOUNT_INVALID";

export class InventoryAdjustmentReversalError extends Error {
  constructor(public readonly code: InventoryAdjustmentReversalErrorCode, public readonly field: string) {
    super(`${code}:${field}`);
    this.name = "InventoryAdjustmentReversalError";
  }
}

export type InventoryAdjustmentValuationState =
  | { readonly method: "fifo"; readonly state: InventoryFifoState }
  | { readonly method: "moving_average"; readonly state: InventoryMovingAverageState };

export interface InventoryAdjustmentValuationResult {
  readonly movementId: string;
  readonly companyId: string;
  readonly productId: string;
  readonly warehouseId: string;
  readonly policyId: string;
  readonly method: InventoryValuationMethod;
  readonly strategyVersion: number;
  readonly currency: CurrencyCode;
  readonly quantity: string;
  readonly unitCost: InventoryUnitCostAmount;
  readonly totalCost: InventoryCostAmount;
  readonly direction: "increase" | "decrease";
  readonly nextState: InventoryAdjustmentValuationState;
  readonly fifoConsumptions: readonly InventoryFifoConsumption[];
  readonly createdLayer: InventoryFifoLayerState | null;
}

export interface InventoryReversibleValuationFact {
  readonly movementId: string;
  readonly companyId: string;
  readonly productId: string;
  readonly warehouseId: string;
  readonly policyId: string;
  readonly method: InventoryValuationMethod;
  readonly strategyVersion: number;
  readonly currency: CurrencyCode;
  readonly businessDate: string;
  readonly businessOrder: number;
  readonly quantity: string;
  readonly totalCost: InventoryCostAmount;
}

export interface InventoryReversalValuationResult {
  readonly reversalMovementId: string;
  readonly originalMovementId: string;
  readonly companyId: string;
  readonly productId: string;
  readonly warehouseId: string;
  readonly policyId: string;
  readonly method: InventoryValuationMethod;
  readonly strategyVersion: number;
  readonly currency: CurrencyCode;
  readonly quantity: string;
  readonly totalCost: InventoryCostAmount;
  readonly requiresRecalculation: true;
  readonly recalculationFromBusinessDate: string;
  readonly recalculationFromBusinessOrder: number;
}

const fail = (code: InventoryAdjustmentReversalErrorCode, field: string): never => {
  throw new InventoryAdjustmentReversalError(code, field);
};

function quantity(value: string, sign: "positive" | "negative"): string {
  if (!value || value === "0" || value === "-0") return fail("ADJUSTMENT_VALUATION_MOVEMENT_INVALID", "quantityDelta");
  if (sign === "positive") {
    if (value.startsWith("-")) return fail("ADJUSTMENT_VALUATION_MOVEMENT_INVALID", "quantityDelta");
    return value;
  }
  if (!value.startsWith("-")) return fail("ADJUSTMENT_VALUATION_MOVEMENT_INVALID", "quantityDelta");
  return value.slice(1);
}

function assertMovement(movement: InventoryStockMovementSnapshot): void {
  if (!movement || movement.transferId !== null || movement.reversalOfMovementId !== null) {
    return fail("ADJUSTMENT_VALUATION_MOVEMENT_INVALID", "movement");
  }
}

function policy(policies: readonly InventoryValuationPolicySnapshot[], movement: InventoryStockMovementSnapshot) {
  return resolveInventoryValuationPolicy(policies, {
    companyId: movement.companyId,
    productId: movement.stockKey.productId,
    warehouseId: movement.stockKey.warehouseId,
    businessDate: movement.businessDate,
  }).policy;
}

function assertMethod(state: InventoryAdjustmentValuationState, method: InventoryValuationMethod): void {
  if (!state || state.method !== method) return fail("ADJUSTMENT_VALUATION_STATE_METHOD_MISMATCH", "state");
}

function assertCurrency(expected: CurrencyCode, actual: CurrencyCode, field: string): void {
  if (expected !== actual) return fail("ADJUSTMENT_VALUATION_CURRENCY_MISMATCH", field);
}

export function calculatePositiveInventoryAdjustmentValuation(input: {
  readonly movement: InventoryStockMovementSnapshot;
  readonly policies: readonly InventoryValuationPolicySnapshot[];
  readonly currentState: InventoryAdjustmentValuationState;
  readonly costBasis: InventoryResolvedInboundCostBasis;
  readonly layerId?: string;
}): InventoryAdjustmentValuationResult {
  assertMovement(input.movement);
  const q = quantity(input.movement.quantityDelta, "positive");
  const selected = policy(input.policies, input.movement);
  assertMethod(input.currentState, selected.method);
  const basis = input.costBasis;
  if (!basis || basis.movementId !== input.movement.movementId || basis.productId !== input.movement.stockKey.productId ||
      basis.warehouseId !== input.movement.stockKey.warehouseId || basis.quantity !== q) {
    return fail("ADJUSTMENT_VALUATION_BASIS_MISMATCH", "costBasis");
  }
  assertCurrency(selected.currency, basis.currency, "costBasis.currency");
  if (!Number.isSafeInteger(basis.totalCost) || basis.totalCost < 0) return fail("ADJUSTMENT_VALUATION_INPUT_INVALID", "costBasis.totalCost");

  if (selected.method === "moving_average") {
    if (input.currentState.method !== "moving_average") return fail("ADJUSTMENT_VALUATION_STATE_METHOD_MISMATCH", "state");
    const current = input.currentState.state;
    if (current.quantity !== "0") assertCurrency(selected.currency, current.currency, "state.currency");
    const nextTotalCost = current.totalCost + basis.totalCost;
    if (!Number.isSafeInteger(nextTotalCost)) return fail("ADJUSTMENT_VALUATION_INPUT_INVALID", "nextTotalCost");
    const next: InventoryMovingAverageState = Object.freeze({
      quantity: addInventoryStockQuantities(current.quantity, q),
      totalCost: nextTotalCost,
      currency: selected.currency,
    });
    return Object.freeze({ movementId: input.movement.movementId, companyId: input.movement.companyId,
      productId: input.movement.stockKey.productId, warehouseId: input.movement.stockKey.warehouseId,
      policyId: selected.policyId, method: selected.method, strategyVersion: selected.strategyVersion,
      currency: selected.currency, quantity: q, unitCost: basis.unitCost, totalCost: basis.totalCost,
      direction: "increase", nextState: Object.freeze({ method: "moving_average", state: next }),
      fifoConsumptions: Object.freeze([]), createdLayer: null });
  }

  if (input.currentState.method !== "fifo") return fail("ADJUSTMENT_VALUATION_STATE_METHOD_MISMATCH", "state");
  const layerId = input.layerId?.trim();
  if (!layerId || input.currentState.state.layers.some((item) => item.layerId === layerId)) {
    return fail("ADJUSTMENT_VALUATION_LAYER_ID_INVALID", "layerId");
  }
  const createdLayer: InventoryFifoLayerState = Object.freeze({
    layerId, remainingQuantity: q, remainingCost: basis.totalCost, currency: selected.currency,
  });
  const next: InventoryFifoState = Object.freeze({ layers: Object.freeze([...input.currentState.state.layers, createdLayer]) });
  return Object.freeze({ movementId: input.movement.movementId, companyId: input.movement.companyId,
    productId: input.movement.stockKey.productId, warehouseId: input.movement.stockKey.warehouseId,
    policyId: selected.policyId, method: selected.method, strategyVersion: selected.strategyVersion,
    currency: selected.currency, quantity: q, unitCost: basis.unitCost, totalCost: basis.totalCost,
    direction: "increase", nextState: Object.freeze({ method: "fifo", state: next }),
    fifoConsumptions: Object.freeze([]), createdLayer });
}

export function calculateNegativeInventoryAdjustmentValuation(input: {
  readonly movement: InventoryStockMovementSnapshot;
  readonly policies: readonly InventoryValuationPolicySnapshot[];
  readonly currentState: InventoryAdjustmentValuationState;
}): InventoryAdjustmentValuationResult {
  assertMovement(input.movement);
  const q = quantity(input.movement.quantityDelta, "negative");
  const selected = policy(input.policies, input.movement);
  assertMethod(input.currentState, selected.method);
  if (selected.method === "moving_average") {
    if (input.currentState.method !== "moving_average") return fail("ADJUSTMENT_VALUATION_STATE_METHOD_MISMATCH", "state");
    const issue = movingAverageInventoryValuationStrategy.issue(input.currentState.state, { quantity: q, currency: selected.currency });
    return Object.freeze({ movementId: input.movement.movementId, companyId: input.movement.companyId,
      productId: input.movement.stockKey.productId, warehouseId: input.movement.stockKey.warehouseId,
      policyId: selected.policyId, method: selected.method, strategyVersion: selected.strategyVersion,
      currency: selected.currency, quantity: q, unitCost: issue.unitCost, totalCost: issue.totalCost,
      direction: "decrease", nextState: Object.freeze({ method: "moving_average", state: issue.state }),
      fifoConsumptions: Object.freeze([]), createdLayer: null });
  }
  if (input.currentState.method !== "fifo") return fail("ADJUSTMENT_VALUATION_STATE_METHOD_MISMATCH", "state");
  const issue = fifoInventoryValuationStrategy.issue(input.currentState.state, { quantity: q, currency: selected.currency });
  return Object.freeze({ movementId: input.movement.movementId, companyId: input.movement.companyId,
    productId: input.movement.stockKey.productId, warehouseId: input.movement.stockKey.warehouseId,
    policyId: selected.policyId, method: selected.method, strategyVersion: selected.strategyVersion,
    currency: selected.currency, quantity: q, unitCost: issue.unitCost, totalCost: issue.totalCost,
    direction: "decrease", nextState: Object.freeze({ method: "fifo", state: issue.state }),
    fifoConsumptions: issue.consumptions, createdLayer: null });
}

export function createInventoryReversalValuation(input: {
  readonly reversalMovement: InventoryStockMovementSnapshot;
  readonly original: InventoryReversibleValuationFact;
}): InventoryReversalValuationResult {
  const movement = input.reversalMovement;
  const original = input.original;
  if (!movement || !original || movement.reversalOfMovementId !== original.movementId || movement.transferId !== null) {
    return fail("REVERSAL_VALUATION_LINK_INVALID", "reversalOfMovementId");
  }
  if (movement.companyId !== original.companyId || movement.stockKey.productId !== original.productId ||
      movement.stockKey.warehouseId !== original.warehouseId) return fail("REVERSAL_VALUATION_LINK_INVALID", "sourceIdentity");
  const expected = original.totalCost < 0 ? original.quantity : `-${original.quantity}`;
  if (movement.quantityDelta !== expected) return fail("REVERSAL_VALUATION_LINK_INVALID", "quantityDelta");
  if (!Number.isSafeInteger(original.totalCost)) return fail("REVERSAL_VALUATION_AMOUNT_INVALID", "original.totalCost");
  const compensation = -original.totalCost;
  return Object.freeze({ reversalMovementId: movement.movementId, originalMovementId: original.movementId,
    companyId: original.companyId, productId: original.productId, warehouseId: original.warehouseId,
    policyId: original.policyId, method: original.method, strategyVersion: original.strategyVersion,
    currency: original.currency, quantity: original.quantity, totalCost: compensation,
    requiresRecalculation: true, recalculationFromBusinessDate: original.businessDate,
    recalculationFromBusinessOrder: original.businessOrder });
}
