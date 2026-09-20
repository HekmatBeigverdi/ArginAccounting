import type { CurrencyCode } from "@argin/platform";
import { addInventoryStockQuantities, serializeInventoryStockKey, type InventoryStockMovementSnapshot } from "./inventory-stock.ts";
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

export type InventoryTransferCostErrorCode =
  | "TRANSFER_COST_INPUT_INVALID"
  | "TRANSFER_COST_MOVEMENT_PAIR_INVALID"
  | "TRANSFER_COST_STATE_METHOD_MISMATCH"
  | "TRANSFER_COST_CURRENCY_MISMATCH"
  | "TRANSFER_COST_DESTINATION_LAYER_ID_INVALID"
  | "TRANSFER_COST_CONSERVATION_INVALID";

export class InventoryTransferCostError extends Error {
  constructor(
    public readonly code: InventoryTransferCostErrorCode,
    public readonly field: string,
  ) {
    super(`${code}:${field}`);
    this.name = "InventoryTransferCostError";
  }
}

export type InventoryTransferValuationState =
  | { readonly method: "fifo"; readonly state: InventoryFifoState }
  | { readonly method: "moving_average"; readonly state: InventoryMovingAverageState };

export interface InventoryTransferCostResult {
  readonly transferId: string;
  readonly companyId: string;
  readonly productId: string;
  readonly sourceMovementId: string;
  readonly destinationMovementId: string;
  readonly policyId: string;
  readonly method: InventoryValuationMethod;
  readonly strategyVersion: number;
  readonly currency: CurrencyCode;
  readonly quantity: string;
  readonly unitCost: InventoryUnitCostAmount;
  /** Negative monetary effect on source valuation state. */
  readonly sourceTotalCost: InventoryCostAmount;
  /** Positive monetary effect on destination valuation state. */
  readonly destinationTotalCost: InventoryCostAmount;
  /** Always zero for a valid ordinary transfer. */
  readonly netTotalCost: 0;
  readonly sourceNextState: InventoryTransferValuationState;
  readonly destinationNextState: InventoryTransferValuationState;
  readonly sourceConsumptions: readonly InventoryFifoConsumption[];
  readonly destinationLayers: readonly InventoryFifoLayerState[];
}

const fail = (code: InventoryTransferCostErrorCode, field: string): never => {
  throw new InventoryTransferCostError(code, field);
};

function id(value: string | null, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail("TRANSFER_COST_INPUT_INVALID", field);
  return value.trim();
}

function absoluteOutboundQuantity(value: string): string {
  if (typeof value !== "string" || !value.startsWith("-") || value === "-0") {
    return fail("TRANSFER_COST_MOVEMENT_PAIR_INVALID", "source.quantityDelta");
  }
  return value.slice(1);
}

function assertMovementPair(source: InventoryStockMovementSnapshot, destination: InventoryStockMovementSnapshot): {
  readonly transferId: string;
  readonly quantity: string;
} {
  if (!source || !destination) return fail("TRANSFER_COST_INPUT_INVALID", "movements");
  const sourceTransferId = id(source.transferId, "source.transferId");
  const destinationTransferId = id(destination.transferId, "destination.transferId");
  if (sourceTransferId !== destinationTransferId) return fail("TRANSFER_COST_MOVEMENT_PAIR_INVALID", "transferId");
  if (source.reversalOfMovementId !== null || destination.reversalOfMovementId !== null) {
    return fail("TRANSFER_COST_MOVEMENT_PAIR_INVALID", "reversalOfMovementId");
  }
  if (source.companyId !== destination.companyId || source.documentId !== destination.documentId || source.lineId !== destination.lineId) {
    return fail("TRANSFER_COST_MOVEMENT_PAIR_INVALID", "sourceIdentity");
  }
  if (source.stockKey.productId !== destination.stockKey.productId) {
    return fail("TRANSFER_COST_MOVEMENT_PAIR_INVALID", "productId");
  }
  if (source.businessDate !== destination.businessDate || source.businessOrder !== destination.businessOrder) {
    return fail("TRANSFER_COST_MOVEMENT_PAIR_INVALID", "businessChronology");
  }
  if (serializeInventoryStockKey(source.stockKey) === serializeInventoryStockKey(destination.stockKey)) {
    return fail("TRANSFER_COST_MOVEMENT_PAIR_INVALID", "stockKey");
  }
  const quantity = absoluteOutboundQuantity(source.quantityDelta);
  if (destination.quantityDelta.startsWith("-") || destination.quantityDelta === "0") {
    return fail("TRANSFER_COST_MOVEMENT_PAIR_INVALID", "destination.quantityDelta");
  }
  if (addInventoryStockQuantities(source.quantityDelta, destination.quantityDelta) !== "0") {
    return fail("TRANSFER_COST_MOVEMENT_PAIR_INVALID", "quantityDelta");
  }
  return Object.freeze({ transferId: sourceTransferId, quantity });
}

function assertStateMethod(state: InventoryTransferValuationState, method: InventoryValuationMethod, field: string): void {
  if (!state || state.method !== method) return fail("TRANSFER_COST_STATE_METHOD_MISMATCH", field);
}

function assertCurrency(expected: CurrencyCode, actual: CurrencyCode, field: string): void {
  if (expected !== actual) return fail("TRANSFER_COST_CURRENCY_MISMATCH", field);
}

function assertFifoDestinationCurrency(state: InventoryFifoState, currency: CurrencyCode): void {
  for (const layer of state.layers) assertCurrency(currency, layer.currency, "destinationState.currency");
}

function uniqueDestinationLayerIds(ids: readonly string[], expectedCount: number): readonly string[] {
  if (!Array.isArray(ids) || ids.length !== expectedCount) {
    return fail("TRANSFER_COST_DESTINATION_LAYER_ID_INVALID", "destinationLayerIds");
  }
  const normalized = ids.map((value, index) => {
    if (typeof value !== "string" || !value.trim()) {
      return fail("TRANSFER_COST_DESTINATION_LAYER_ID_INVALID", `destinationLayerIds[${index}]`);
    }
    return value.trim();
  });
  if (new Set(normalized).size !== normalized.length) {
    return fail("TRANSFER_COST_DESTINATION_LAYER_ID_INVALID", "destinationLayerIds");
  }
  return Object.freeze(normalized);
}

function resolvePolicy(
  policies: readonly InventoryValuationPolicySnapshot[],
  movement: InventoryStockMovementSnapshot,
): InventoryValuationPolicySnapshot {
  return resolveInventoryValuationPolicy(policies, {
    companyId: movement.companyId,
    productId: movement.stockKey.productId,
    warehouseId: movement.stockKey.warehouseId,
    businessDate: movement.businessDate,
  }).policy;
}

export function calculateInventoryTransferCost(input: {
  readonly sourceMovement: InventoryStockMovementSnapshot;
  readonly destinationMovement: InventoryStockMovementSnapshot;
  readonly policies: readonly InventoryValuationPolicySnapshot[];
  readonly sourceState: InventoryTransferValuationState;
  readonly destinationState: InventoryTransferValuationState;
  /** Required for FIFO: one durable destination layer id per consumed source layer, in consumption order. */
  readonly destinationLayerIds?: readonly string[];
}): InventoryTransferCostResult {
  if (!input || typeof input !== "object") return fail("TRANSFER_COST_INPUT_INVALID", "input");
  const pair = assertMovementPair(input.sourceMovement, input.destinationMovement);
  const policy = resolvePolicy(input.policies, input.sourceMovement);
  const destinationPolicy = resolvePolicy(input.policies, input.destinationMovement);
  if (
    policy.policyId !== destinationPolicy.policyId ||
    policy.method !== destinationPolicy.method ||
    policy.strategyVersion !== destinationPolicy.strategyVersion ||
    policy.currency !== destinationPolicy.currency
  ) {
    return fail("TRANSFER_COST_MOVEMENT_PAIR_INVALID", "policy");
  }

  assertStateMethod(input.sourceState, policy.method, "sourceState");
  assertStateMethod(input.destinationState, policy.method, "destinationState");

  if (policy.method === "moving_average") {
    if (input.sourceState.method !== "moving_average" || input.destinationState.method !== "moving_average") {
      return fail("TRANSFER_COST_STATE_METHOD_MISMATCH", "state");
    }
    assertCurrency(policy.currency, input.sourceState.state.currency, "sourceState.currency");
    if (input.destinationState.state.quantity !== "0") {
      assertCurrency(policy.currency, input.destinationState.state.currency, "destinationState.currency");
    }

    const sourceIssue = movingAverageInventoryValuationStrategy.issue(input.sourceState.state, {
      quantity: pair.quantity,
      currency: policy.currency,
    });
    const carriedCost = -sourceIssue.totalCost;
    const destinationQuantity = addInventoryStockQuantities(input.destinationState.state.quantity, pair.quantity);
    const destinationTotalCost = input.destinationState.state.totalCost + carriedCost;
    if (!Number.isSafeInteger(destinationTotalCost) || destinationTotalCost < 0) {
      return fail("TRANSFER_COST_CONSERVATION_INVALID", "destinationTotalCost");
    }
    const destinationNext: InventoryMovingAverageState = Object.freeze({
      quantity: destinationQuantity,
      totalCost: destinationTotalCost,
      currency: policy.currency,
    });
    if (sourceIssue.totalCost + carriedCost !== 0) return fail("TRANSFER_COST_CONSERVATION_INVALID", "totalCost");

    return Object.freeze({
      transferId: pair.transferId,
      companyId: input.sourceMovement.companyId,
      productId: input.sourceMovement.stockKey.productId,
      sourceMovementId: input.sourceMovement.movementId,
      destinationMovementId: input.destinationMovement.movementId,
      policyId: policy.policyId,
      method: policy.method,
      strategyVersion: policy.strategyVersion,
      currency: policy.currency,
      quantity: pair.quantity,
      unitCost: sourceIssue.unitCost,
      sourceTotalCost: sourceIssue.totalCost,
      destinationTotalCost: carriedCost,
      netTotalCost: 0,
      sourceNextState: Object.freeze({ method: "moving_average", state: sourceIssue.state }),
      destinationNextState: Object.freeze({ method: "moving_average", state: destinationNext }),
      sourceConsumptions: Object.freeze([]),
      destinationLayers: Object.freeze([]),
    });
  }

  if (input.sourceState.method !== "fifo" || input.destinationState.method !== "fifo") {
    return fail("TRANSFER_COST_STATE_METHOD_MISMATCH", "state");
  }
  assertFifoDestinationCurrency(input.destinationState.state, policy.currency);
  const sourceIssue = fifoInventoryValuationStrategy.issue(input.sourceState.state, {
    quantity: pair.quantity,
    currency: policy.currency,
  });
  const layerIds = uniqueDestinationLayerIds(input.destinationLayerIds ?? [], sourceIssue.consumptions.length);
  const existingDestinationIds = new Set(input.destinationState.state.layers.map((layer) => layer.layerId));
  for (const layerId of layerIds) {
    if (existingDestinationIds.has(layerId)) return fail("TRANSFER_COST_DESTINATION_LAYER_ID_INVALID", "destinationLayerIds");
  }
  const transferredLayers = sourceIssue.consumptions.map((consumption, index): InventoryFifoLayerState => Object.freeze({
    layerId: layerIds[index]!,
    remainingQuantity: consumption.quantity,
    remainingCost: consumption.cost,
    currency: policy.currency,
  }));
  const carriedCost = transferredLayers.reduce((sum, layer) => sum + layer.remainingCost, 0);
  if (!Number.isSafeInteger(carriedCost) || sourceIssue.totalCost + carriedCost !== 0) {
    return fail("TRANSFER_COST_CONSERVATION_INVALID", "totalCost");
  }
  const destinationNext: InventoryFifoState = Object.freeze({
    layers: Object.freeze([...input.destinationState.state.layers, ...transferredLayers]),
  });

  return Object.freeze({
    transferId: pair.transferId,
    companyId: input.sourceMovement.companyId,
    productId: input.sourceMovement.stockKey.productId,
    sourceMovementId: input.sourceMovement.movementId,
    destinationMovementId: input.destinationMovement.movementId,
    policyId: policy.policyId,
    method: policy.method,
    strategyVersion: policy.strategyVersion,
    currency: policy.currency,
    quantity: pair.quantity,
    unitCost: sourceIssue.unitCost,
    sourceTotalCost: sourceIssue.totalCost,
    destinationTotalCost: carriedCost,
    netTotalCost: 0,
    sourceNextState: Object.freeze({ method: "fifo", state: sourceIssue.state }),
    destinationNextState: Object.freeze({ method: "fifo", state: destinationNext }),
    sourceConsumptions: sourceIssue.consumptions,
    destinationLayers: Object.freeze(transferredLayers),
  });
}
