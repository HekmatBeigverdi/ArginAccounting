import type { ProductUnitDefinition, ProductUnitProfile, QuantityRoundingMode } from "@argin/product";
import { INVENTORY_DOMAIN_ERROR_CODES as codes, InventoryDomainError } from "./inventory-errors.ts";

// JSON/SQLite/Bridge boundaries use canonical decimal strings, never BigInt values.
export interface InventoryUnitSnapshot {
  readonly unitId: string;
  readonly code: string;
  readonly title: string;
  readonly ratioToBase: string;
  readonly precision: number;
  readonly roundingMode: QuantityRoundingMode;
  readonly taxpayerUnitCode: string | null;
}
export interface InventoryQuantitySnapshot {
  readonly enteredQuantity: string;
  readonly baseQuantity: string;
  readonly enteredUnit: InventoryUnitSnapshot;
  readonly baseUnit: InventoryUnitSnapshot;
}
interface Decimal { readonly coefficient: bigint; readonly scale: number; }
const error = (code: (typeof codes)[keyof typeof codes], field: string): never => {
  throw new InventoryDomainError(code, field);
};
const power = (scale: number): bigint => 10n ** BigInt(scale);

/** At most 36 integer places and 18 decimal places; canonical zero is "0". */
export function normalizeInventoryQuantity(value: string): string {
  if (typeof value !== "string" || value.length > 128 || !/^-?\d+(?:\.\d+)?$/u.test(value.trim())) {
    return error(codes.quantityInvalid, "quantity");
  }
  const text = value.trim();
  const negative = text.startsWith("-");
  const [integer = "", fraction = ""] = (negative ? text.slice(1) : text).split(".");
  const whole = integer.replace(/^0+(?=\d)/u, "");
  const decimals = fraction.replace(/0+$/u, "");
  if (whole.length > 36 || decimals.length > 18) return error(codes.quantityInvalid, "quantity");
  const magnitude = whole + (decimals ? `.${decimals}` : "");
  return negative && magnitude !== "0" ? `-${magnitude}` : magnitude;
}
function parse(value: string): Decimal {
  const canonical = normalizeInventoryQuantity(value);
  const [whole = "0", fractional = ""] = canonical.split(".");
  return { coefficient: BigInt(whole + fractional), scale: fractional.length };
}
function format(coefficient: bigint, scale: number): string {
  const negative = coefficient < 0n;
  const digits = (negative ? -coefficient : coefficient).toString().padStart(scale + 1, "0");
  const text = scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits;
  return normalizeInventoryQuantity((negative ? "-" : "") + text);
}
function required(value: string): string {
  if (typeof value !== "string" || !value.trim()) return error(codes.unitInvalid, "unit");
  return value.trim();
}
function normalizeUnit(input: InventoryUnitSnapshot): InventoryUnitSnapshot {
  if (!input || typeof input !== "object" || !Number.isInteger(input.precision) || input.precision < 0 || input.precision > 6 ||
      !["half-up", "down", "up"].includes(input.roundingMode)) return error(codes.unitInvalid, "unit");
  const ratioToBase = normalizeInventoryQuantity(input.ratioToBase);
  if (parse(ratioToBase).coefficient <= 0n) return error(codes.unitInvalid, "unit.ratioToBase");
  return Object.freeze({
    unitId: required(input.unitId), code: required(input.code).toUpperCase(), title: required(input.title),
    ratioToBase, precision: input.precision, roundingMode: input.roundingMode,
    taxpayerUnitCode: input.taxpayerUnitCode == null ? null : required(input.taxpayerUnitCode),
  });
}

/** Preserve the decimal spelling of the legacy ratio, expanding exponent notation without float arithmetic. */
function legacyRatio(value: number): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > Number.MAX_SAFE_INTEGER) {
    return error(codes.unitInvalid, "unit.ratioToBase");
  }
  const [mantissa = "", exponentText] = value.toString().split("e");
  if (exponentText === undefined) return normalizeInventoryQuantity(mantissa);
  const exponent = Number(exponentText);
  // Product allows very small numbers; unsupported precision must fail explicitly.
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 36) return error(codes.unitInvalid, "unit.ratioToBase");
  const [whole = "", fraction = ""] = mantissa.split(".");
  const digits = whole + fraction;
  const point = whole.length + exponent;
  const expanded = point <= 0 ? `0.${"0".repeat(-point)}${digits}`
    : point >= digits.length ? digits + "0".repeat(point - digits.length)
      : `${digits.slice(0, point)}.${digits.slice(point)}`;
  return normalizeInventoryQuantity(expanded);
}
function snapshotProductUnit(unit: ProductUnitDefinition): InventoryUnitSnapshot {
  if (!unit || typeof unit !== "object") return error(codes.unitInvalid, "unit");
  return normalizeUnit({
    unitId: unit.unitId, code: unit.code, title: unit.title,
    ratioToBase: legacyRatio(unit.ratioToBase), precision: unit.precision,
    roundingMode: unit.roundingMode, taxpayerUnitCode: unit.taxpayerUnitCode ?? null,
  });
}
function convert(enteredQuantity: string, enteredUnit: InventoryUnitSnapshot, baseUnit: InventoryUnitSnapshot): string {
  const quantity = parse(enteredQuantity);
  if (quantity.coefficient === 0n) return error(codes.quantityZero, "enteredQuantity");
  if (quantity.scale > enteredUnit.precision) return error(codes.quantityPrecisionInvalid, "enteredQuantity");
  if (baseUnit.ratioToBase !== "1") return error(codes.unitInvalid, "baseUnit.ratioToBase");
  if (enteredUnit.unitId === baseUnit.unitId && JSON.stringify(enteredUnit) !== JSON.stringify(baseUnit)) {
    return error(codes.unitInvalid, "enteredUnit");
  }
  const ratio = parse(enteredUnit.ratioToBase);
  const numerator = quantity.coefficient * ratio.coefficient * power(baseUnit.precision);
  const denominator = power(quantity.scale + ratio.scale);
  const negative = numerator < 0n;
  const magnitude = negative ? -numerator : numerator;
  let units = magnitude / denominator;
  const remainder = magnitude % denominator;
  // Phase 18: down=toward zero, up=away from zero, half-up=ties away from zero.
  if ((baseUnit.roundingMode === "up" && remainder !== 0n) ||
      (baseUnit.roundingMode === "half-up" && remainder * 2n >= denominator)) units += 1n;
  if (units === 0n) return error(codes.quantityZero, "baseQuantity");
  return format(negative ? -units : units, baseUnit.precision);
}
export function createInventoryQuantitySnapshot(input: {
  readonly enteredQuantity: string;
  readonly unitId: string;
  readonly profile: ProductUnitProfile;
}): InventoryQuantitySnapshot {
  if (!input || !input.profile || !Array.isArray(input.profile.units) || !input.profile.units.length) {
    return error(codes.unitInvalid, "profile");
  }
  const units = Array.from(input.profile.units, snapshotProductUnit);
  const ids = new Set<string>(), unitCodes = new Set<string>();
  for (const unit of units) {
    if (ids.has(unit.unitId) || unitCodes.has(unit.code)) return error(codes.unitInvalid, "profile.units");
    ids.add(unit.unitId); unitCodes.add(unit.code);
  }
  const enteredUnit = units.find(unit => unit.unitId === required(input.unitId));
  const baseUnit = units.find(unit => unit.unitId === required(input.profile.baseUnitId));
  if (!enteredUnit || !baseUnit) return error(codes.unitNotFound, "unitId");
  const enteredQuantity = normalizeInventoryQuantity(input.enteredQuantity);
  return Object.freeze({ enteredQuantity, baseQuantity: convert(enteredQuantity, enteredUnit, baseUnit), enteredUnit, baseUnit });
}
/** Validate stored conversion using the stored units, not today's Product profile. */
export function rehydrateInventoryQuantitySnapshot(input: InventoryQuantitySnapshot): InventoryQuantitySnapshot {
  if (!input || typeof input !== "object") return error(codes.quantityInvalid, "quantity");
  const enteredUnit = normalizeUnit(input.enteredUnit), baseUnit = normalizeUnit(input.baseUnit);
  const enteredQuantity = normalizeInventoryQuantity(input.enteredQuantity);
  const baseQuantity = convert(enteredQuantity, enteredUnit, baseUnit);
  if (normalizeInventoryQuantity(input.baseQuantity) !== baseQuantity) return error(codes.quantitySnapshotMismatch, "baseQuantity");
  return Object.freeze({ enteredQuantity, baseQuantity, enteredUnit, baseUnit });
}
