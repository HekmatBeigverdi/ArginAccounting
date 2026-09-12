import type { CurrencyCode } from "@argin/platform";
import {
  createUnresolvedInventoryValuationEntry,
  type InventoryValuationEntrySnapshot,
  type InventoryValuationMethod,
} from "./inventory-valuation.ts";
import { normalizeInventoryQuantity } from "./inventory-quantity.ts";
import type { InventoryStockMovementSnapshot } from "./inventory-stock.ts";

export const INVENTORY_NEGATIVE_STOCK_ACTIONS = ["block", "defer"] as const;
export type InventoryNegativeStockAction = (typeof INVENTORY_NEGATIVE_STOCK_ACTIONS)[number];

export const INVENTORY_COST_RESOLUTION_OUTCOMES = ["resolved", "blocked", "deferred"] as const;
export type InventoryCostResolutionOutcome = (typeof INVENTORY_COST_RESOLUTION_OUTCOMES)[number];

export const INVENTORY_COST_UNRESOLVED_REASONS = [
  "negative_stock",
  "missing_inbound_cost",
  "upstream_cost_unresolved",
  "insufficient_cost_basis",
] as const;
export type InventoryCostUnresolvedReason = (typeof INVENTORY_COST_UNRESOLVED_REASONS)[number];

export interface InventoryCostResolutionPolicy {
  readonly version: 1;
  readonly negativeStockAction: InventoryNegativeStockAction;
  readonly missingInboundCostAction: "defer";
  readonly insufficientCostBasisAction: "defer";
  readonly upstreamUnresolvedCostAction: "defer";
}

export const DEFAULT_INVENTORY_COST_RESOLUTION_POLICY: InventoryCostResolutionPolicy = Object.freeze({
  version: 1,
  negativeStockAction: "block",
  missingInboundCostAction: "defer",
  insufficientCostBasisAction: "defer",
  upstreamUnresolvedCostAction: "defer",
});

export type InventoryCostResolutionErrorCode =
  | "COST_RESOLUTION_INPUT_INVALID"
  | "COST_RESOLUTION_POLICY_INVALID"
  | "COST_RESOLUTION_QUANTITY_INVALID"
  | "COST_RESOLUTION_BLOCKED";

export class InventoryCostResolutionError extends Error {
  constructor(
    public readonly code: InventoryCostResolutionErrorCode,
    public readonly field: string,
  ) {
    super(`${code}:${field}`);
    this.name = "InventoryCostResolutionError";
  }
}

export interface InventoryCostResolutionDecision {
  readonly outcome: InventoryCostResolutionOutcome;
  readonly reason: InventoryCostUnresolvedReason | null;
  readonly requiresRecalculation: boolean;
  readonly blocksConfirmation: boolean;
}

type Decimal = { readonly coefficient: bigint; readonly scale: number };

const fail = (code: InventoryCostResolutionErrorCode, field: string): never => {
  throw new InventoryCostResolutionError(code, field);
};

function parseQuantity(value: string, field: string, allowZero = true): Decimal {
  let normalized: string;
  try {
    normalized = normalizeInventoryQuantity(value);
  } catch {
    return fail("COST_RESOLUTION_QUANTITY_INVALID", field);
  }
  if (normalized.startsWith("-") || (!allowZero && normalized === "0")) {
    return fail("COST_RESOLUTION_QUANTITY_INVALID", field);
  }
  const [whole = "0", fraction = ""] = normalized.split(".");
  return { coefficient: BigInt(`${whole}${fraction}`), scale: fraction.length };
}

function compareDecimal(left: Decimal, right: Decimal): number {
  const scale = Math.max(left.scale, right.scale);
  const scaledLeft = left.coefficient * 10n ** BigInt(scale - left.scale);
  const scaledRight = right.coefficient * 10n ** BigInt(scale - right.scale);
  if (scaledLeft < scaledRight) return -1;
  if (scaledLeft > scaledRight) return 1;
  return 0;
}

function resolvePolicy(input: InventoryCostResolutionPolicy | undefined): InventoryCostResolutionPolicy {
  const value = input ?? DEFAULT_INVENTORY_COST_RESOLUTION_POLICY;
  if (
    !value ||
    value.version !== 1 ||
    !INVENTORY_NEGATIVE_STOCK_ACTIONS.includes(value.negativeStockAction) ||
    value.missingInboundCostAction !== "defer" ||
    value.insufficientCostBasisAction !== "defer" ||
    value.upstreamUnresolvedCostAction !== "defer"
  ) {
    return fail("COST_RESOLUTION_POLICY_INVALID", "policy");
  }
  return value;
}

export function createInventoryCostResolutionPolicy(input: {
  readonly negativeStockAction?: InventoryNegativeStockAction;
} = {}): InventoryCostResolutionPolicy {
  const action = input.negativeStockAction ?? "block";
  if (!INVENTORY_NEGATIVE_STOCK_ACTIONS.includes(action)) {
    return fail("COST_RESOLUTION_POLICY_INVALID", "negativeStockAction");
  }
  return Object.freeze({
    version: 1 as const,
    negativeStockAction: action,
    missingInboundCostAction: "defer" as const,
    insufficientCostBasisAction: "defer" as const,
    upstreamUnresolvedCostAction: "defer" as const,
  });
}

function deferredDecision(reason: InventoryCostUnresolvedReason): InventoryCostResolutionDecision {
  return Object.freeze({
    outcome: "deferred",
    reason,
    requiresRecalculation: true,
    blocksConfirmation: false,
  });
}

export function evaluateInventoryOutboundCostResolution(input: {
  readonly requestedQuantity: string;
  readonly availablePhysicalQuantity: string;
  readonly availableCostedQuantity: string;
  readonly hasUpstreamUnresolvedCost?: boolean;
  readonly policy?: InventoryCostResolutionPolicy;
}): InventoryCostResolutionDecision {
  if (!input || typeof input !== "object") return fail("COST_RESOLUTION_INPUT_INVALID", "input");
  const activePolicy = resolvePolicy(input.policy);
  const requested = parseQuantity(input.requestedQuantity, "requestedQuantity", false);
  const physical = parseQuantity(input.availablePhysicalQuantity, "availablePhysicalQuantity");
  const costed = parseQuantity(input.availableCostedQuantity, "availableCostedQuantity");
  if (compareDecimal(costed, physical) > 0) {
    return fail("COST_RESOLUTION_INPUT_INVALID", "availableCostedQuantity");
  }

  if (compareDecimal(requested, physical) > 0) {
    if (activePolicy.negativeStockAction === "block") {
      return Object.freeze({
        outcome: "blocked",
        reason: "negative_stock",
        requiresRecalculation: false,
        blocksConfirmation: true,
      });
    }
    return deferredDecision("negative_stock");
  }

  if (input.hasUpstreamUnresolvedCost === true) {
    return deferredDecision("upstream_cost_unresolved");
  }

  if (compareDecimal(requested, costed) > 0) {
    return deferredDecision("insufficient_cost_basis");
  }

  return Object.freeze({
    outcome: "resolved",
    reason: null,
    requiresRecalculation: false,
    blocksConfirmation: false,
  });
}

export function evaluateInventoryInboundCostResolution(input: {
  readonly hasResolvedCostBasis: boolean;
  readonly hasUpstreamUnresolvedCost?: boolean;
  readonly policy?: InventoryCostResolutionPolicy;
}): InventoryCostResolutionDecision {
  if (!input || typeof input !== "object") return fail("COST_RESOLUTION_INPUT_INVALID", "input");
  resolvePolicy(input.policy);
  if (input.hasUpstreamUnresolvedCost === true) {
    return deferredDecision("upstream_cost_unresolved");
  }
  if (!input.hasResolvedCostBasis) {
    return deferredDecision("missing_inbound_cost");
  }
  return Object.freeze({
    outcome: "resolved",
    reason: null,
    requiresRecalculation: false,
    blocksConfirmation: false,
  });
}

export function assertInventoryCostResolutionAllowed(decision: InventoryCostResolutionDecision): void {
  if (!decision || typeof decision !== "object") return fail("COST_RESOLUTION_INPUT_INVALID", "decision");
  if (decision.outcome === "blocked") return fail("COST_RESOLUTION_BLOCKED", decision.reason ?? "cost");
}

export function createDeferredInventoryValuationEntry(input: {
  readonly valuationEntryId: string;
  readonly movement: InventoryStockMovementSnapshot;
  readonly method: InventoryValuationMethod;
  readonly strategyVersion: number;
  readonly currency?: CurrencyCode;
  readonly decision: InventoryCostResolutionDecision;
  readonly revision?: number;
}): InventoryValuationEntrySnapshot {
  if (
    !input ||
    typeof input !== "object" ||
    !input.decision ||
    input.decision.outcome !== "deferred" ||
    !input.decision.reason
  ) {
    return fail("COST_RESOLUTION_INPUT_INVALID", "decision");
  }
  return createUnresolvedInventoryValuationEntry({
    valuationEntryId: input.valuationEntryId,
    movement: input.movement,
    method: input.method,
    strategyVersion: input.strategyVersion,
    ...(input.currency !== undefined ? { currency: input.currency } : {}),
    reason: input.decision.reason,
    ...(input.revision !== undefined ? { revision: input.revision } : {}),
  });
}
