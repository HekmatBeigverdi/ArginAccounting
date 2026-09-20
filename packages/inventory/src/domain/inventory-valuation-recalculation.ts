import {
  compareInventoryStockMovements,
  type InventoryStockMovementSnapshot,
} from "./inventory-stock.ts";

export const INVENTORY_RECALCULATION_REASONS = [
  "backdated_movement",
  "movement_changed",
  "cost_basis_changed",
  "reversal",
  "policy_changed",
] as const;
export type InventoryRecalculationReason = (typeof INVENTORY_RECALCULATION_REASONS)[number];

export type InventoryValuationRecalculationErrorCode =
  | "VALUATION_RECALCULATION_INPUT_INVALID"
  | "VALUATION_RECALCULATION_TRIGGER_INVALID"
  | "VALUATION_RECALCULATION_SCOPE_INVALID"
  | "VALUATION_RECALCULATION_DUPLICATE_MOVEMENT";

export class InventoryValuationRecalculationError extends Error {
  constructor(public readonly code: InventoryValuationRecalculationErrorCode, public readonly field: string) {
    super(`${code}:${field}`);
    this.name = "InventoryValuationRecalculationError";
  }
}

export interface InventoryValuationChronologyPoint {
  readonly businessDate: string;
  readonly businessOrder: number;
  readonly documentId: string | null;
  readonly lineId: string | null;
  readonly movementId: string | null;
}

export type InventoryValuationRecalculationTrigger =
  | {
      readonly reason: "backdated_movement" | "movement_changed" | "cost_basis_changed";
      readonly movement: InventoryStockMovementSnapshot;
    }
  | {
      readonly reason: "reversal";
      readonly companyId: string;
      readonly productId: string;
      readonly originalBusinessDate: string;
      readonly originalBusinessOrder: number;
    }
  | {
      readonly reason: "policy_changed";
      readonly companyId: string;
      readonly effectiveFrom: string;
    };

export interface InventoryValuationRecalculationPlan {
  readonly reason: InventoryRecalculationReason;
  readonly companyId: string;
  /** null means all Products in the Company are affected, e.g. Company policy transition. */
  readonly productId: string | null;
  readonly from: InventoryValuationChronologyPoint;
  readonly movementIds: readonly string[];
  readonly movements: readonly InventoryStockMovementSnapshot[];
}

export interface InventoryValuationReplayStep<TResult> {
  readonly index: number;
  readonly movementId: string;
  readonly result: TResult;
}

export interface InventoryValuationReplayResult<TState, TResult> {
  readonly finalState: TState;
  readonly steps: readonly InventoryValuationReplayStep<TResult>[];
}

const fail = (code: InventoryValuationRecalculationErrorCode, field: string): never => {
  throw new InventoryValuationRecalculationError(code, field);
};

function requiredId(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail("VALUATION_RECALCULATION_TRIGGER_INVALID", field);
  return value.trim();
}

function date(value: string, field: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return fail("VALUATION_RECALCULATION_TRIGGER_INVALID", field);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return fail("VALUATION_RECALCULATION_TRIGGER_INVALID", field);
  }
  return value;
}

function order(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) return fail("VALUATION_RECALCULATION_TRIGGER_INVALID", field);
  return value;
}

function movementPoint(movement: InventoryStockMovementSnapshot): InventoryValuationChronologyPoint {
  return Object.freeze({
    businessDate: movement.businessDate,
    businessOrder: movement.businessOrder,
    documentId: movement.documentId,
    lineId: movement.lineId,
    movementId: movement.movementId,
  });
}

function coarsePoint(businessDate: string, businessOrder: number): InventoryValuationChronologyPoint {
  return Object.freeze({ businessDate, businessOrder, documentId: null, lineId: null, movementId: null });
}

/**
 * Compare a movement to a recalculation boundary. Null durable tie-breakers mean the boundary
 * starts before every movement sharing the same businessDate/businessOrder.
 */
export function compareInventoryMovementToValuationPoint(
  movement: InventoryStockMovementSnapshot,
  point: InventoryValuationChronologyPoint,
): number {
  if (movement.businessDate !== point.businessDate) return movement.businessDate < point.businessDate ? -1 : 1;
  if (movement.businessOrder !== point.businessOrder) return movement.businessOrder < point.businessOrder ? -1 : 1;
  if (point.documentId === null) return 0;
  if (movement.documentId !== point.documentId) return movement.documentId < point.documentId ? -1 : 1;
  if (point.lineId === null) return 0;
  if (movement.lineId !== point.lineId) return movement.lineId < point.lineId ? -1 : 1;
  if (point.movementId === null) return 0;
  if (movement.movementId !== point.movementId) return movement.movementId < point.movementId ? -1 : 1;
  return 0;
}

function validateMovements(input: readonly InventoryStockMovementSnapshot[]): readonly InventoryStockMovementSnapshot[] {
  if (!Array.isArray(input)) return fail("VALUATION_RECALCULATION_INPUT_INVALID", "movements");
  const ids = new Set<string>();
  const result = [...input];
  for (const movement of result) {
    if (!movement || typeof movement.movementId !== "string") return fail("VALUATION_RECALCULATION_INPUT_INVALID", "movements");
    if (ids.has(movement.movementId)) return fail("VALUATION_RECALCULATION_DUPLICATE_MOVEMENT", "movementId");
    ids.add(movement.movementId);
  }
  result.sort(compareInventoryStockMovements);
  return Object.freeze(result);
}

export function createInventoryValuationRecalculationPlan(input: {
  readonly movements: readonly InventoryStockMovementSnapshot[];
  readonly trigger: InventoryValuationRecalculationTrigger;
}): InventoryValuationRecalculationPlan {
  if (!input || typeof input !== "object" || !input.trigger) return fail("VALUATION_RECALCULATION_INPUT_INVALID", "input");
  const ordered = validateMovements(input.movements);
  const trigger = input.trigger;

  let companyId: string;
  let productId: string | null;
  let from: InventoryValuationChronologyPoint;

  if (trigger.reason === "policy_changed") {
    companyId = requiredId(trigger.companyId, "trigger.companyId");
    productId = null;
    from = coarsePoint(date(trigger.effectiveFrom, "trigger.effectiveFrom"), 1);
  } else if (trigger.reason === "reversal") {
    companyId = requiredId(trigger.companyId, "trigger.companyId");
    productId = requiredId(trigger.productId, "trigger.productId");
    from = coarsePoint(
      date(trigger.originalBusinessDate, "trigger.originalBusinessDate"),
      order(trigger.originalBusinessOrder, "trigger.originalBusinessOrder"),
    );
  } else {
    const movement = trigger.movement;
    if (!movement) return fail("VALUATION_RECALCULATION_TRIGGER_INVALID", "trigger.movement");
    companyId = requiredId(movement.companyId, "trigger.movement.companyId");
    productId = requiredId(movement.stockKey.productId, "trigger.movement.productId");
    from = movementPoint(movement);
  }

  const affected = ordered.filter((movement) => {
    if (movement.companyId !== companyId) return false;
    if (productId !== null && movement.stockKey.productId !== productId) return false;
    return compareInventoryMovementToValuationPoint(movement, from) >= 0;
  });

  return Object.freeze({
    reason: trigger.reason,
    companyId,
    productId,
    from,
    movementIds: Object.freeze(affected.map((movement) => movement.movementId)),
    movements: Object.freeze(affected),
  });
}

/**
 * Persistence-neutral deterministic replay loop. Application/Persistence steps provide the seed
 * snapshot and pure movement applier that invokes the Step 5–8 valuation primitives.
 */
export function replayInventoryValuationPlan<TState, TResult>(input: {
  readonly plan: InventoryValuationRecalculationPlan;
  readonly seedState: TState;
  readonly apply: (state: TState, movement: InventoryStockMovementSnapshot, index: number) => {
    readonly state: TState;
    readonly result: TResult;
  };
}): InventoryValuationReplayResult<TState, TResult> {
  if (!input || !input.plan || typeof input.apply !== "function") return fail("VALUATION_RECALCULATION_INPUT_INVALID", "replay");
  let state = input.seedState;
  const steps: InventoryValuationReplayStep<TResult>[] = [];
  for (let index = 0; index < input.plan.movements.length; index += 1) {
    const movement = input.plan.movements[index]!;
    const applied = input.apply(state, movement, index);
    if (!applied || !("state" in applied)) return fail("VALUATION_RECALCULATION_INPUT_INVALID", "applyResult");
    state = applied.state;
    steps.push(Object.freeze({ index, movementId: movement.movementId, result: applied.result }));
  }
  return Object.freeze({ finalState: state, steps: Object.freeze(steps) });
}
