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
  readonly recordedAt: string;
  readonly stockKey: InventoryStockKey;
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
  readonly recordedAt: string;
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
    zoneId: warehouse.zoneId,
    locationId: warehouse.locationId,
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
  const quantityDelta = normalizeInventoryQuantity(input.quantityDelta);
  if (quantityDelta === "0") return fail(codes.quantityZero, "quantityDelta");
  return Object.freeze({
    movementId: id(input.movementId, "movementId"),
    companyId: stockKey.companyId,
    documentId: id(input.documentId, "documentId"),
    lineId: id(input.lineId, "lineId"),
    businessDate: date(input.businessDate, "businessDate"),
    recordedAt: timestamp(input.recordedAt, "recordedAt"),
    stockKey,
    quantityDelta,
  });
}

export function rehydrateInventoryStockMovement(
  input: InventoryStockMovementSnapshot,
): InventoryStockMovementSnapshot {
  if (!input || typeof input !== "object") return fail(codes.inputInvalid, "movement");
  if (!input.stockKey || typeof input.stockKey !== "object") return fail(codes.stockKeyInvalid, "stockKey");
  const warehouse = createWarehouseOperationalReference({
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
    recordedAt: input.recordedAt,
    quantityDelta: input.quantityDelta,
  });
  if (serializeInventoryStockKey(movement.stockKey) !== serializeInventoryStockKey(input.stockKey)) {
    return fail(codes.stockKeyInvalid, "stockKey");
  }
  return movement;
}

/**
 * Canonical ledger order: business date first, then durable document/line/movement IDs.
 * recordedAt is evidence, not stock chronology, so replicas rebuild the same balance history.
 */
export function compareInventoryStockMovements(
  left: InventoryStockMovementSnapshot,
  right: InventoryStockMovementSnapshot,
): number {
  for (const [a, b] of [
    [left.businessDate, right.businessDate],
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
  const movements = input.map(rehydrateInventoryStockMovement).sort(compareInventoryStockMovements);
  const balances = new Map<string, InventoryStockBalanceSnapshot>();

  for (const movement of movements) {
    if (movementIds.has(movement.movementId)) return fail(codes.duplicateMovementId, "movementId");
    movementIds.add(movement.movementId);
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

  const orderedBalances = Array.from(balances.values()).sort((a, b) =>
    serializeInventoryStockKey(a.stockKey).localeCompare(serializeInventoryStockKey(b.stockKey)));
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
