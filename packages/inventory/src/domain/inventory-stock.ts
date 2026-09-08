import type { WarehouseOperationalReference } from "@argin/warehouse";
import { createWarehouseOperationalReference } from "@argin/warehouse";
import { INVENTORY_DOMAIN_ERROR_CODES as codes, InventoryDomainError } from "./inventory-errors.ts";
import { normalizeInventoryQuantity } from "./inventory-quantity.ts";

export interface InventoryStockKey {
  readonly companyId: string;
  readonly productId: string;
  readonly warehouseId: string;
  readonly zoneId: string | null;
  readonly locationId: string | null;
}

export interface InventoryStockMovementSnapshot {
  readonly movementId: string;
  readonly companyId: string;
  readonly documentId: string;
  readonly lineId: string;
  readonly businessDate: string;
  /** Stable positive ordering value assigned by the authoritative confirmation boundary. */
  readonly businessOrder: number;
  readonly recordedAt: string;
  readonly stockKey: InventoryStockKey;
  /** Present on both source and destination facts of one transfer; null for non-transfer movements. */
  readonly transferId: string | null;
  /** Original immutable movement neutralized by this compensating fact, when this is a reversal. */
  readonly reversalOfMovementId: string | null;
  /** Signed quantity in the Product base unit. Positive=in, negative=out. */
  readonly quantityDelta: string;
}

export interface CreateInventoryStockMovementInput {
  readonly movementId: string;
  readonly companyId: string;
  readonly documentId: string;
  readonly lineId: string;
  readonly productId: string;
  readonly warehouse: WarehouseOperationalReference;
  readonly businessDate: string;
  readonly businessOrder: number;
  readonly recordedAt: string;
  readonly transferId?: string | null;
  readonly reversalOfMovementId?: string | null;
  readonly quantityDelta: string;
}

export interface InventoryStockBalanceSnapshot {
  readonly stockKey: InventoryStockKey;
  readonly quantity: string;
  readonly movementCount: number;
  readonly lastMovementId: string | null;
}

export interface InventoryStockLedgerSnapshot {
  readonly movements: readonly InventoryStockMovementSnapshot[];
  readonly balances: readonly InventoryStockBalanceSnapshot[];
}

interface Decimal {
  readonly coefficient: bigint;
  readonly scale: number;
}

const fail = (code: (typeof codes)[keyof typeof codes], field: string): never => {
  throw new InventoryDomainError(code, field);
};

function id(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail(codes.identityRequired, field);
  return value.trim();
}

function optionalId(value: string | null | undefined, field: string): string | null {
  return value == null ? null : id(value, field);
}

function date(value: string, field: string): string {
  if (typeof value !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return fail(codes.businessDateInvalid, field);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return fail(codes.businessDateInvalid, field);
  }
  return value;
}

function positiveOrder(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) return fail(codes.stockOrderInvalid, "businessOrder");
  return value;
}

function timestamp(value: string, field: string): string {
  if (typeof value !== "string" ||
      !/^(?!0000)\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/u.test(value)) {
    return fail(codes.timestampInvalid, field);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value.slice(0, 10)) {
    return fail(codes.timestampInvalid, field);
  }
  return parsed.toISOString();
}

function reference(input: WarehouseOperationalReference): WarehouseOperationalReference {
  if (!input || typeof input !== "object") return fail(codes.referenceInvalid, "warehouse");
  const warehouseId = id(input.warehouseId, "warehouse.warehouseId");
  const zoneId = input.zoneId == null ? null : id(input.zoneId, "warehouse.zoneId");
  const locationId = input.locationId == null ? null : id(input.locationId, "warehouse.locationId");
  if (locationId && !zoneId) return fail(codes.referenceInvalid, "warehouse.zoneId");
  return createWarehouseOperationalReference({ warehouseId, zoneId, locationId });
}

export function createInventoryStockKey(input: {
  readonly companyId: string;
  readonly productId: string;
  readonly warehouse: WarehouseOperationalReference;
}): InventoryStockKey {
  if (!input || typeof input !== "object") return fail(codes.inputInvalid, "stockKey");
  const warehouse = reference(input.warehouse);
  return Object.freeze({
    companyId: id(input.companyId, "stockKey.companyId"),
    productId: id(input.productId, "stockKey.productId"),
    warehouseId: warehouse.warehouseId,
    zoneId: warehouse.zoneId ?? null,
    locationId: warehouse.locationId ?? null,
  });
}

function decimal(value: string): Decimal {
  const canonical = normalizeInventoryQuantity(value);
  const negative = canonical.startsWith("-");
  const unsigned = negative ? canonical.slice(1) : canonical;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const coefficient = BigInt(`${negative ? "-" : ""}${whole}${fraction}`);
  return { coefficient, scale: fraction.length };
}

function power(scale: number): bigint {
  return 10n ** BigInt(scale);
}

function format(coefficient: bigint, scale: number): string {
  const negative = coefficient < 0n;
  const digits = (negative ? -coefficient : coefficient).toString().padStart(scale + 1, "0");
  const unsigned = scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return normalizeInventoryQuantity(`${negative ? "-" : ""}${unsigned}`);
}

/** Exact decimal addition used by quantity ledger projections; no JavaScript floating point. */
export function addInventoryStockQuantities(left: string, right: string): string {
  const a = decimal(left), b = decimal(right);
  const scale = Math.max(a.scale, b.scale);
  const coefficient = a.coefficient * power(scale - a.scale) + b.coefficient * power(scale - b.scale);
  return format(coefficient, scale);
}

function compareInventoryStockQuantities(left: string, right: string): number {
  const a = decimal(left), b = decimal(right);
  const scale = Math.max(a.scale, b.scale);
  const aa = a.coefficient * power(scale - a.scale), bb = b.coefficient * power(scale - b.scale);
  return aa === bb ? 0 : aa < bb ? -1 : 1;
}

export function serializeInventoryStockKey(key: InventoryStockKey): string {
  if (!key || typeof key !== "object") return fail(codes.stockKeyInvalid, "stockKey");
  const normalized = createInventoryStockKey({
    companyId: key.companyId,
    productId: key.productId,
    warehouse: createWarehouseOperationalReference({
      warehouseId: key.warehouseId,
      zoneId: key.zoneId,
      locationId: key.locationId,
    }),
  });
  return JSON.stringify([
    normalized.companyId,
    normalized.productId,
    normalized.warehouseId,
    normalized.zoneId,
    normalized.locationId,
  ]);
}

export function createInventoryStockMovement(
  input: CreateInventoryStockMovementInput,
): InventoryStockMovementSnapshot {
  if (!input || typeof input !== "object") return fail(codes.inputInvalid, "movement");
  const stockKey = createInventoryStockKey({
    companyId: input.companyId,
    productId: input.productId,
    warehouse: input.warehouse,
  });
  const movementId = id(input.movementId, "movementId");
  const reversalOfMovementId = optionalId(input.reversalOfMovementId, "reversalOfMovementId");
  if (reversalOfMovementId === movementId) return fail(codes.reversalReferenceInvalid, "reversalOfMovementId");
  const quantityDelta = normalizeInventoryQuantity(input.quantityDelta);
  if (quantityDelta === "0") return fail(codes.quantityZero, "quantityDelta");
  return Object.freeze({
    movementId,
    companyId: stockKey.companyId,
    documentId: id(input.documentId, "documentId"),
    lineId: id(input.lineId, "lineId"),
    businessDate: date(input.businessDate, "businessDate"),
    businessOrder: positiveOrder(input.businessOrder),
    recordedAt: timestamp(input.recordedAt, "recordedAt"),
    stockKey,
    transferId: optionalId(input.transferId, "transferId"),
    reversalOfMovementId,
    quantityDelta,
  });
}

export function rehydrateInventoryStockMovement(
  input: InventoryStockMovementSnapshot,
): InventoryStockMovementSnapshot {
  if (!input || typeof input !== "object") return fail(codes.inputInvalid, "movement");
  if (!input.stockKey || typeof input.stockKey !== "object") return fail(codes.stockKeyInvalid, "stockKey");
  const warehouse = reference({
    warehouseId: input.stockKey.warehouseId,
    zoneId: input.stockKey.zoneId,
    locationId: input.stockKey.locationId,
  });
  const movement = createInventoryStockMovement({
    movementId: input.movementId,
    companyId: input.companyId,
    documentId: input.documentId,
    lineId: input.lineId,
    productId: input.stockKey.productId,
    warehouse,
    businessDate: input.businessDate,
    businessOrder: input.businessOrder,
    recordedAt: input.recordedAt,
    transferId: input.transferId ?? null,
    reversalOfMovementId: input.reversalOfMovementId ?? null,
    quantityDelta: input.quantityDelta,
  });
  if (serializeInventoryStockKey(movement.stockKey) !== serializeInventoryStockKey(input.stockKey)) {
    return fail(codes.stockKeyInvalid, "stockKey");
  }
  return movement;
}

/** Canonical order is business date, explicit business order, then durable tie breakers. */
export function compareInventoryStockMovements(
  left: InventoryStockMovementSnapshot,
  right: InventoryStockMovementSnapshot,
): number {
  if (left.businessDate !== right.businessDate) return left.businessDate < right.businessDate ? -1 : 1;
  if (left.businessOrder !== right.businessOrder) return left.businessOrder < right.businessOrder ? -1 : 1;
  for (const [a, b] of [
    [left.documentId, right.documentId],
    [left.lineId, right.lineId],
    [left.movementId, right.movementId],
  ] as const) {
    if (a !== b) return a < b ? -1 : 1;
  }
  return 0;
}

/**
 * Rebuilds every balance exclusively from immutable movement facts.
 * Default policy rejects a negative running balance at any historical point, including
 * after insertion of a backdated movement. Existing persisted balances are never trusted.
 */
export function rebuildInventoryStockLedger(
  input: readonly InventoryStockMovementSnapshot[],
  options: { readonly allowNegativeStock?: boolean } = {},
): InventoryStockLedgerSnapshot {
  if (!Array.isArray(input)) return fail(codes.inputInvalid, "movements");
  const movementIds = new Set<string>();
  const sourceFacts = new Set<string>();
  const reversedMovementIds = new Set<string>();
  const movements: InventoryStockMovementSnapshot[] = [];
  for (const raw of input) movements.push(rehydrateInventoryStockMovement(raw));
  movements.sort(compareInventoryStockMovements);
  const balances = new Map<string, InventoryStockBalanceSnapshot>();

  for (const movement of movements) {
    if (movementIds.has(movement.movementId)) return fail(codes.duplicateMovementId, "movementId");
    movementIds.add(movement.movementId);
    if (movement.reversalOfMovementId !== null) {
      if (reversedMovementIds.has(movement.reversalOfMovementId)) {
        return fail(codes.reversalReferenceInvalid, "reversalOfMovementId");
      }
      reversedMovementIds.add(movement.reversalOfMovementId);
    }
    const sourceKey = JSON.stringify([
      movement.companyId,
      movement.documentId,
      movement.lineId,
      serializeInventoryStockKey(movement.stockKey),
    ]);
    if (sourceFacts.has(sourceKey)) return fail(codes.duplicateMovementSource, "lineId");
    sourceFacts.add(sourceKey);

    const key = serializeInventoryStockKey(movement.stockKey);
    const current = balances.get(key);
    const quantity = addInventoryStockQuantities(current?.quantity ?? "0", movement.quantityDelta);
    if (options.allowNegativeStock !== true && compareInventoryStockQuantities(quantity, "0") < 0) {
      return fail(codes.negativeStock, "quantityDelta");
    }
    balances.set(key, Object.freeze({
      stockKey: movement.stockKey,
      quantity,
      movementCount: (current?.movementCount ?? 0) + 1,
      lastMovementId: movement.movementId,
    }));
  }

  const orderedBalances = Array.from(balances.values()).sort((a, b) => {
    const aa = serializeInventoryStockKey(a.stockKey), bb = serializeInventoryStockKey(b.stockKey);
    return aa === bb ? 0 : aa < bb ? -1 : 1;
  });
  return Object.freeze({
    movements: Object.freeze(movements),
    balances: Object.freeze(orderedBalances),
  });
}

/** Appends one fact by rebuilding chronology; rejected facts never mutate the caller ledger. */
export function appendInventoryStockMovement(
  ledger: InventoryStockLedgerSnapshot,
  movement: InventoryStockMovementSnapshot,
  options: { readonly allowNegativeStock?: boolean } = {},
): InventoryStockLedgerSnapshot {
  if (!ledger || typeof ledger !== "object" || !Array.isArray(ledger.movements)) {
    return fail(codes.inputInvalid, "ledger");
  }
  return rebuildInventoryStockLedger([...ledger.movements, movement], options);
}

export function getInventoryStockBalance(
  ledger: InventoryStockLedgerSnapshot,
  stockKey: InventoryStockKey,
): InventoryStockBalanceSnapshot {
  if (!ledger || typeof ledger !== "object" || !Array.isArray(ledger.balances)) {
    return fail(codes.inputInvalid, "ledger");
  }
  const key = serializeInventoryStockKey(stockKey);
  const balance = ledger.balances.find(item => serializeInventoryStockKey(item.stockKey) === key);
  return balance ?? Object.freeze({
    stockKey: createInventoryStockKey({
      companyId: stockKey.companyId,
      productId: stockKey.productId,
      warehouse: createWarehouseOperationalReference({
        warehouseId: stockKey.warehouseId,
        zoneId: stockKey.zoneId,
        locationId: stockKey.locationId,
      }),
    }),
    quantity: "0",
    movementCount: 0,
    lastMovementId: null,
  });
}
