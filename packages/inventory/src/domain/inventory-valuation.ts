import { IRR, normalizeCurrencyCode, type CurrencyCode } from "@argin/platform";
import { normalizeInventoryQuantity } from "./inventory-quantity.ts";
import {
  serializeInventoryStockKey,
  type InventoryStockKey,
  type InventoryStockMovementSnapshot,
} from "./inventory-stock.ts";

export const INVENTORY_VALUATION_METHODS = ["moving_average", "fifo"] as const;
export type InventoryValuationMethod = (typeof INVENTORY_VALUATION_METHODS)[number];

export const INVENTORY_COST_STATES = ["resolved", "unresolved"] as const;
export type InventoryCostState = (typeof INVENTORY_COST_STATES)[number];

export const INVENTORY_VALUATION_ENTRY_KINDS = ["inbound", "outbound", "transfer", "reversal"] as const;
export type InventoryValuationEntryKind = (typeof INVENTORY_VALUATION_ENTRY_KINDS)[number];

/**
 * Monetary totals use the Platform Money invariant: safe integer amount in the
 * smallest currency unit. Unit cost remains an exact decimal because an average
 * per base unit may be fractional even when the final posted monetary amount is
 * an integer Rial value.
 */
export type InventoryCostAmount = number;
export type InventoryUnitCostAmount = string;

export interface InventoryValuationSource {
  readonly movementId: string;
  readonly documentId: string;
  readonly lineId: string;
  readonly reversalOfMovementId: string | null;
  readonly transferId: string | null;
}

export interface InventoryValuationEntrySnapshot {
  readonly valuationEntryId: string;
  readonly companyId: string;
  readonly productId: string;
  readonly stockKey: InventoryStockKey;
  readonly source: InventoryValuationSource;
  readonly kind: InventoryValuationEntryKind;
  readonly method: InventoryValuationMethod;
  readonly strategyVersion: number;
  readonly currency: CurrencyCode;
  readonly businessDate: string;
  readonly businessOrder: number;
  /** Absolute quantity valued in Product base unit. */
  readonly quantity: string;
  /** Exact decimal monetary cost per base unit; null while unresolved. */
  readonly unitCost: InventoryUnitCostAmount | null;
  /** Signed safe-integer amount in the smallest currency unit. */
  readonly totalCost: InventoryCostAmount | null;
  readonly costState: InventoryCostState;
  readonly unresolvedReason: string | null;
  readonly valuedAt: string | null;
  readonly revision: number;
}

export interface InventoryCostLayerSnapshot {
  readonly costLayerId: string;
  readonly companyId: string;
  readonly productId: string;
  readonly stockKey: InventoryStockKey;
  readonly sourceMovementId: string;
  readonly sourceValuationEntryId: string;
  readonly method: InventoryValuationMethod;
  readonly strategyVersion: number;
  readonly currency: CurrencyCode;
  readonly openedBusinessDate: string;
  readonly openedBusinessOrder: number;
  readonly originalQuantity: string;
  readonly remainingQuantity: string;
  readonly unitCost: InventoryUnitCostAmount;
  readonly originalCost: InventoryCostAmount;
  readonly remainingCost: InventoryCostAmount;
  readonly revision: number;
}

export interface InventoryValuationBasisSnapshot {
  readonly companyId: string;
  readonly productId: string;
  readonly stockKey: InventoryStockKey;
  readonly method: InventoryValuationMethod;
  readonly strategyVersion: number;
  readonly currency: CurrencyCode;
  readonly effectiveFrom: string;
}

export type InventoryValuationDomainErrorCode =
  | "VALUATION_INPUT_INVALID"
  | "VALUATION_ID_REQUIRED"
  | "VALUATION_METHOD_INVALID"
  | "VALUATION_STATE_INVALID"
  | "VALUATION_AMOUNT_INVALID"
  | "VALUATION_QUANTITY_INVALID"
  | "VALUATION_SOURCE_INVALID"
  | "VALUATION_REVISION_INVALID"
  | "VALUATION_STRATEGY_VERSION_INVALID";

export class InventoryValuationDomainError extends Error {
  constructor(
    public readonly code: InventoryValuationDomainErrorCode,
    public readonly field: string,
  ) {
    super(`${code}:${field}`);
    this.name = "InventoryValuationDomainError";
  }
}

const fail = (code: InventoryValuationDomainErrorCode, field: string): never => {
  throw new InventoryValuationDomainError(code, field);
};

function id(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail("VALUATION_ID_REQUIRED", field);
  return value.trim();
}

function positiveInteger(
  value: number,
  field: string,
  code?: "VALUATION_REVISION_INVALID" | "VALUATION_STRATEGY_VERSION_INVALID",
): number {
  if (!Number.isSafeInteger(value) || value < 1) return fail(code ?? "VALUATION_INPUT_INVALID", field);
  return value;
}

function method(value: string): InventoryValuationMethod {
  if (!INVENTORY_VALUATION_METHODS.includes(value as InventoryValuationMethod)) return fail("VALUATION_METHOD_INVALID", "method");
  return value as InventoryValuationMethod;
}

function date(value: string, field: string): string {
  if (typeof value !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}$/u.test(value)) return fail("VALUATION_INPUT_INVALID", field);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return fail("VALUATION_INPUT_INVALID", field);
  return value;
}

function timestamp(value: string, field: string): string {
  if (typeof value !== "string") return fail("VALUATION_INPUT_INVALID", field);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return fail("VALUATION_INPUT_INVALID", field);
  return parsed.toISOString();
}

function unitCost(value: string, field: string): InventoryUnitCostAmount {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value.trim())) return fail("VALUATION_AMOUNT_INVALID", field);
  let [whole, fraction = ""] = value.trim().split(".");
  whole = (whole ?? "0").replace(/^0+(?=\d)/u, "");
  fraction = fraction.replace(/0+$/u, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

function moneyAmount(value: number, field: string, allowNegative: boolean): InventoryCostAmount {
  if (!Number.isSafeInteger(value)) return fail("VALUATION_AMOUNT_INVALID", field);
  if (!allowNegative && value < 0) return fail("VALUATION_AMOUNT_INVALID", field);
  return Object.is(value, -0) ? 0 : value;
}

function currency(value: CurrencyCode | undefined): CurrencyCode {
  try {
    return normalizeCurrencyCode(value ?? IRR.code);
  } catch {
    return fail("VALUATION_INPUT_INVALID", "currency");
  }
}

function absoluteQuantity(value: string, field: string): string {
  let canonical: string;
  try {
    canonical = normalizeInventoryQuantity(value);
  } catch {
    return fail("VALUATION_QUANTITY_INVALID", field);
  }
  if (canonical === "0" || canonical.startsWith("-")) return fail("VALUATION_QUANTITY_INVALID", field);
  return canonical;
}

function sourceFromMovement(movement: InventoryStockMovementSnapshot): InventoryValuationSource {
  if (!movement || typeof movement !== "object") return fail("VALUATION_SOURCE_INVALID", "movement");
  return Object.freeze({
    movementId: id(movement.movementId, "source.movementId"),
    documentId: id(movement.documentId, "source.documentId"),
    lineId: id(movement.lineId, "source.lineId"),
    reversalOfMovementId: movement.reversalOfMovementId ? id(movement.reversalOfMovementId, "source.reversalOfMovementId") : null,
    transferId: movement.transferId ? id(movement.transferId, "source.transferId") : null,
  });
}

function entryKind(movement: InventoryStockMovementSnapshot): InventoryValuationEntryKind {
  if (movement.reversalOfMovementId) return "reversal";
  if (movement.transferId) return "transfer";
  return movement.quantityDelta.startsWith("-") ? "outbound" : "inbound";
}

export function createUnresolvedInventoryValuationEntry(input: {
  readonly valuationEntryId: string;
  readonly movement: InventoryStockMovementSnapshot;
  readonly method: InventoryValuationMethod;
  readonly strategyVersion: number;
  readonly currency?: CurrencyCode;
  readonly reason: string;
  readonly revision?: number;
}): InventoryValuationEntrySnapshot {
  if (!input || typeof input !== "object" || !input.movement || typeof input.movement !== "object") {
    return fail("VALUATION_INPUT_INVALID", "valuationEntry");
  }
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!reason) return fail("VALUATION_STATE_INVALID", "unresolvedReason");
  const movement = input.movement;
  const quantity = absoluteQuantity(
    movement.quantityDelta.startsWith("-") ? movement.quantityDelta.slice(1) : movement.quantityDelta,
    "quantity",
  );
  return Object.freeze({
    valuationEntryId: id(input.valuationEntryId, "valuationEntryId"),
    companyId: id(movement.companyId, "companyId"),
    productId: id(movement.stockKey.productId, "productId"),
    stockKey: Object.freeze({ ...movement.stockKey }),
    source: sourceFromMovement(movement),
    kind: entryKind(movement),
    method: method(input.method),
    strategyVersion: positiveInteger(input.strategyVersion, "strategyVersion", "VALUATION_STRATEGY_VERSION_INVALID"),
    currency: currency(input.currency),
    businessDate: date(movement.businessDate, "businessDate"),
    businessOrder: positiveInteger(movement.businessOrder, "businessOrder"),
    quantity,
    unitCost: null,
    totalCost: null,
    costState: "unresolved",
    unresolvedReason: reason,
    valuedAt: null,
    revision: positiveInteger(input.revision ?? 1, "revision", "VALUATION_REVISION_INVALID"),
  });
}

export function resolveInventoryValuationEntry(
  entry: InventoryValuationEntrySnapshot,
  input: {
    readonly unitCost: string;
    readonly totalCost: number;
    readonly valuedAt: string;
    readonly expectedRevision: number;
  },
): InventoryValuationEntrySnapshot {
  if (!entry || typeof entry !== "object" || !input || typeof input !== "object") return fail("VALUATION_INPUT_INVALID", "valuationEntry");
  if (entry.revision !== input.expectedRevision) return fail("VALUATION_REVISION_INVALID", "expectedRevision");
  const signedTotal = moneyAmount(input.totalCost, "totalCost", true);
  if (entry.kind === "outbound" && signedTotal > 0) return fail("VALUATION_AMOUNT_INVALID", "totalCost");
  if (entry.kind === "inbound" && signedTotal < 0) return fail("VALUATION_AMOUNT_INVALID", "totalCost");
  return Object.freeze({
    ...entry,
    unitCost: unitCost(input.unitCost, "unitCost"),
    totalCost: signedTotal,
    costState: "resolved" as const,
    unresolvedReason: null,
    valuedAt: timestamp(input.valuedAt, "valuedAt"),
    revision: entry.revision + 1,
  });
}

export function createInventoryCostLayer(input: {
  readonly costLayerId: string;
  readonly sourceEntry: InventoryValuationEntrySnapshot;
  readonly originalQuantity: string;
  readonly remainingQuantity?: string;
  readonly unitCost: string;
  readonly originalCost: number;
  readonly remainingCost?: number;
  readonly revision?: number;
}): InventoryCostLayerSnapshot {
  if (!input || typeof input !== "object" || !input.sourceEntry || typeof input.sourceEntry !== "object") {
    return fail("VALUATION_INPUT_INVALID", "sourceEntry");
  }
  if (input.sourceEntry.costState !== "resolved") return fail("VALUATION_STATE_INVALID", "sourceEntry");
  const entry = input.sourceEntry;
  const originalQuantity = absoluteQuantity(input.originalQuantity, "originalQuantity");
  let remainingQuantity: string;
  try {
    remainingQuantity = input.remainingQuantity == null ? originalQuantity : normalizeInventoryQuantity(input.remainingQuantity);
  } catch {
    return fail("VALUATION_QUANTITY_INVALID", "remainingQuantity");
  }
  if (remainingQuantity.startsWith("-")) return fail("VALUATION_QUANTITY_INVALID", "remainingQuantity");
  const originalCost = moneyAmount(input.originalCost, "originalCost", false);
  const remainingCost = moneyAmount(input.remainingCost ?? originalCost, "remainingCost", false);
  return Object.freeze({
    costLayerId: id(input.costLayerId, "costLayerId"),
    companyId: entry.companyId,
    productId: entry.productId,
    stockKey: Object.freeze({ ...entry.stockKey }),
    sourceMovementId: entry.source.movementId,
    sourceValuationEntryId: entry.valuationEntryId,
    method: entry.method,
    strategyVersion: entry.strategyVersion,
    currency: entry.currency,
    openedBusinessDate: entry.businessDate,
    openedBusinessOrder: entry.businessOrder,
    originalQuantity,
    remainingQuantity,
    unitCost: unitCost(input.unitCost, "unitCost"),
    originalCost,
    remainingCost,
    revision: positiveInteger(input.revision ?? 1, "revision", "VALUATION_REVISION_INVALID"),
  });
}

export function createInventoryValuationBasis(
  input: Omit<InventoryValuationBasisSnapshot, "currency"> & { readonly currency?: CurrencyCode },
): InventoryValuationBasisSnapshot {
  if (!input || typeof input !== "object") return fail("VALUATION_INPUT_INVALID", "valuationBasis");
  return Object.freeze({
    companyId: id(input.companyId, "companyId"),
    productId: id(input.productId, "productId"),
    stockKey: Object.freeze({ ...input.stockKey }),
    method: method(input.method),
    strategyVersion: positiveInteger(input.strategyVersion, "strategyVersion", "VALUATION_STRATEGY_VERSION_INVALID"),
    currency: currency(input.currency),
    effectiveFrom: date(input.effectiveFrom, "effectiveFrom"),
  });
}

export function inventoryValuationStreamKey(input: {
  readonly stockKey: InventoryStockKey;
  readonly method: InventoryValuationMethod;
  readonly strategyVersion: number;
  readonly currency?: CurrencyCode;
}): string {
  return JSON.stringify([
    serializeInventoryStockKey(input.stockKey),
    method(input.method),
    positiveInteger(input.strategyVersion, "strategyVersion", "VALUATION_STRATEGY_VERSION_INVALID"),
    currency(input.currency),
  ]);
}
