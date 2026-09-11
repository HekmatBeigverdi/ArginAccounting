import { IRR, normalizeCurrencyCode, type CurrencyCode } from "@argin/platform";
import { normalizeInventoryQuantity } from "./inventory-quantity.ts";
import type { InventoryValuationInboundInput } from "./inventory-valuation-strategy.ts";

export const INVENTORY_LANDED_COST_ALLOCATION_METHODS = ["quantity", "value", "weight"] as const;
export type InventoryLandedCostAllocationMethod = (typeof INVENTORY_LANDED_COST_ALLOCATION_METHODS)[number];

export type InventoryInboundCostErrorCode =
  | "INBOUND_COST_INPUT_INVALID"
  | "INBOUND_COST_ID_REQUIRED"
  | "INBOUND_COST_AMOUNT_INVALID"
  | "INBOUND_COST_QUANTITY_INVALID"
  | "INBOUND_COST_CURRENCY_MISMATCH"
  | "INBOUND_COST_ALLOCATION_INVALID";

export class InventoryInboundCostError extends Error {
  constructor(public readonly code: InventoryInboundCostErrorCode, public readonly field: string) {
    super(`${code}:${field}`);
    this.name = "InventoryInboundCostError";
  }
}

export interface InventoryInboundCostSourceReference {
  readonly sourceType: string;
  readonly sourceId: string;
  readonly sourceLineId: string | null;
}

export interface InventoryInboundCostBasisLine {
  readonly basisLineId: string;
  readonly movementId: string;
  readonly productId: string;
  readonly warehouseId: string;
  readonly quantity: string;
  readonly baseCost: number;
  readonly currency: CurrencyCode;
  readonly allocationWeight: string | null;
}

export interface InventoryLandedCostComponent {
  readonly componentId: string;
  readonly source: InventoryInboundCostSourceReference;
  readonly amount: number;
  readonly currency: CurrencyCode;
  readonly allocationMethod: InventoryLandedCostAllocationMethod;
}

export interface InventoryLandedCostAllocation {
  readonly componentId: string;
  readonly basisLineId: string;
  readonly amount: number;
}

export interface InventoryResolvedInboundCostBasis {
  readonly basisLineId: string;
  readonly movementId: string;
  readonly productId: string;
  readonly warehouseId: string;
  readonly quantity: string;
  readonly currency: CurrencyCode;
  readonly baseCost: number;
  readonly landedCost: number;
  readonly totalCost: number;
  readonly unitCost: string;
  readonly allocations: readonly InventoryLandedCostAllocation[];
}

type Decimal = { readonly coefficient: bigint; readonly scale: number };

const fail = (code: InventoryInboundCostErrorCode, field: string): never => {
  throw new InventoryInboundCostError(code, field);
};

function id(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail("INBOUND_COST_ID_REQUIRED", field);
  return value.trim();
}

function currency(value: CurrencyCode | undefined): CurrencyCode {
  try { return normalizeCurrencyCode(value ?? IRR.code); }
  catch { return fail("INBOUND_COST_INPUT_INVALID", "currency"); }
}

function money(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) return fail("INBOUND_COST_AMOUNT_INVALID", field);
  return value;
}

function quantity(value: string, field: string): string {
  let normalized: string;
  try { normalized = normalizeInventoryQuantity(value); }
  catch { return fail("INBOUND_COST_QUANTITY_INVALID", field); }
  if (normalized === "0" || normalized.startsWith("-")) return fail("INBOUND_COST_QUANTITY_INVALID", field);
  return normalized;
}

function decimal(value: string, field: string, allowZero: boolean): Decimal {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value.trim())) {
    return fail("INBOUND_COST_ALLOCATION_INVALID", field);
  }
  const [whole = "0", fraction = ""] = value.trim().split(".");
  const coefficient = BigInt(`${whole}${fraction}`);
  if (!allowZero && coefficient === 0n) return fail("INBOUND_COST_ALLOCATION_INVALID", field);
  return { coefficient, scale: fraction.length };
}

function pow10(value: number): bigint { return 10n ** BigInt(value); }

function scaledCoefficient(value: Decimal, scale: number): bigint {
  return value.coefficient * pow10(scale - value.scale);
}

function divideToDecimal(numerator: bigint, denominator: bigint, scale = 12): string {
  if (denominator <= 0n) return fail("INBOUND_COST_ALLOCATION_INVALID", "denominator");
  const scaled = numerator * pow10(scale);
  let quotient = scaled / denominator;
  const remainder = scaled % denominator;
  if (remainder * 2n >= denominator) quotient += 1n;
  let digits = quotient.toString();
  if (scale > 0) {
    if (digits.length <= scale) digits = `${"0".repeat(scale - digits.length + 1)}${digits}`;
    digits = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.0+$/u, "").replace(/(\.\d*?)0+$/u, "$1");
  }
  return digits;
}

export function createInventoryInboundCostBasisLine(input: {
  readonly basisLineId: string;
  readonly movementId: string;
  readonly productId: string;
  readonly warehouseId: string;
  readonly quantity: string;
  readonly baseCost: number;
  readonly currency?: CurrencyCode;
  readonly allocationWeight?: string | null;
}): InventoryInboundCostBasisLine {
  const normalizedWeight = input.allocationWeight == null ? null : input.allocationWeight.trim();
  if (normalizedWeight !== null) decimal(normalizedWeight, "allocationWeight", false);
  return Object.freeze({
    basisLineId: id(input.basisLineId, "basisLineId"), movementId: id(input.movementId, "movementId"),
    productId: id(input.productId, "productId"), warehouseId: id(input.warehouseId, "warehouseId"),
    quantity: quantity(input.quantity, "quantity"), baseCost: money(input.baseCost, "baseCost"),
    currency: currency(input.currency), allocationWeight: normalizedWeight,
  });
}

export function createInventoryLandedCostComponent(input: InventoryLandedCostComponent): InventoryLandedCostComponent {
  if (!INVENTORY_LANDED_COST_ALLOCATION_METHODS.includes(input.allocationMethod)) return fail("INBOUND_COST_ALLOCATION_INVALID", "allocationMethod");
  return Object.freeze({
    componentId: id(input.componentId, "componentId"),
    source: Object.freeze({ sourceType: id(input.source.sourceType, "source.sourceType"), sourceId: id(input.source.sourceId, "source.sourceId"), sourceLineId: input.source.sourceLineId == null ? null : id(input.source.sourceLineId, "source.sourceLineId") }),
    amount: money(input.amount, "amount"), currency: currency(input.currency), allocationMethod: input.allocationMethod,
  });
}

function allocationBasis(line: InventoryInboundCostBasisLine, method: InventoryLandedCostAllocationMethod): Decimal {
  if (method === "quantity") return decimal(line.quantity, "quantity", false);
  if (method === "value") return { coefficient: BigInt(line.baseCost), scale: 0 };
  if (line.allocationWeight === null) return fail("INBOUND_COST_ALLOCATION_INVALID", "allocationWeight");
  return decimal(line.allocationWeight, "allocationWeight", false);
}

export function allocateInventoryLandedCost(input: {
  readonly lines: readonly InventoryInboundCostBasisLine[];
  readonly components: readonly InventoryLandedCostComponent[];
}): readonly InventoryLandedCostAllocation[] {
  if (input.lines.length === 0) return fail("INBOUND_COST_ALLOCATION_INVALID", "lines");
  const allocations: InventoryLandedCostAllocation[] = [];
  const currencyCode = input.lines[0]?.currency ?? fail("INBOUND_COST_ALLOCATION_INVALID", "lines");
  if (input.lines.some((line) => line.currency !== currencyCode)) return fail("INBOUND_COST_CURRENCY_MISMATCH", "lines.currency");

  for (const component of input.components) {
    if (component.currency !== currencyCode) return fail("INBOUND_COST_CURRENCY_MISMATCH", "component.currency");
    const bases = input.lines.map((line) => allocationBasis(line, component.allocationMethod));
    const scale = Math.max(...bases.map((basis) => basis.scale));
    const scaled = bases.map((basis) => scaledCoefficient(basis, scale));
    const denominator = scaled.reduce((total, value) => total + value, 0n);
    if (denominator <= 0n) return fail("INBOUND_COST_ALLOCATION_INVALID", "allocationBasis");

    let allocated = 0;
    for (let index = 0; index < input.lines.length; index += 1) {
      const line = input.lines[index]!;
      const isLast = index === input.lines.length - 1;
      const amount = isLast
        ? component.amount - allocated
        : Number((BigInt(component.amount) * scaled[index]! + denominator / 2n) / denominator);
      allocated += amount;
      allocations.push(Object.freeze({ componentId: component.componentId, basisLineId: line.basisLineId, amount }));
    }
    if (allocated !== component.amount) return fail("INBOUND_COST_ALLOCATION_INVALID", "remainder");
  }
  return Object.freeze(allocations);
}

export function resolveInventoryInboundCostBasis(input: {
  readonly lines: readonly InventoryInboundCostBasisLine[];
  readonly components?: readonly InventoryLandedCostComponent[];
}): readonly InventoryResolvedInboundCostBasis[] {
  const allocations = allocateInventoryLandedCost({ lines: input.lines, components: input.components ?? [] });
  return Object.freeze(input.lines.map((line) => {
    const lineAllocations = allocations.filter((allocation) => allocation.basisLineId === line.basisLineId);
    const landedCost = lineAllocations.reduce((total, allocation) => total + allocation.amount, 0);
    const totalCost = line.baseCost + landedCost;
    if (!Number.isSafeInteger(totalCost)) return fail("INBOUND_COST_AMOUNT_INVALID", "totalCost");
    const q = decimal(line.quantity, "quantity", false);
    const unitCost = divideToDecimal(BigInt(totalCost) * pow10(q.scale), q.coefficient);
    return Object.freeze({ ...line, landedCost, totalCost, unitCost, allocations: Object.freeze(lineAllocations) });
  }));
}

export function inventoryValuationInboundInputFromCostBasis(
  basis: InventoryResolvedInboundCostBasis,
  layerId?: string,
): InventoryValuationInboundInput {
  return layerId === undefined
    ? Object.freeze({ quantity: basis.quantity, unitCost: basis.unitCost, currency: basis.currency })
    : Object.freeze({ quantity: basis.quantity, unitCost: basis.unitCost, currency: basis.currency, layerId });
}
