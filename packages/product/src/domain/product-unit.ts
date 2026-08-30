import {
  PRODUCT_DOMAIN_ERROR_CODES,
  ProductDomainError,
} from "./product.ts";

export type QuantityRoundingMode = "half-up" | "down" | "up";

export interface ProductUnitDefinition {
  readonly unitId: string;
  readonly code: string;
  readonly title: string;
  readonly ratioToBase: number;
  readonly precision: number;
  readonly roundingMode: QuantityRoundingMode;
}

export interface ProductUnitProfile {
  readonly baseUnitId: string;
  readonly units: readonly Readonly<ProductUnitDefinition>[];
}

export interface CreateProductUnitProfileInput {
  readonly baseUnit: Omit<ProductUnitDefinition, "ratioToBase">;
  readonly alternateUnits?: readonly ProductUnitDefinition[];
}

const normalizeRequired = (value: string): string => {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (normalized.length === 0) {
    throw new ProductDomainError(PRODUCT_DOMAIN_ERROR_CODES.unitInvalid);
  }
  return normalized;
};

const normalizeUnit = (
  unit: ProductUnitDefinition,
  isBase: boolean,
): Readonly<ProductUnitDefinition> => {
  if (!Number.isFinite(unit.ratioToBase) || unit.ratioToBase <= 0) {
    throw new ProductDomainError(PRODUCT_DOMAIN_ERROR_CODES.unitRatioInvalid);
  }
  if (!Number.isInteger(unit.precision) || unit.precision < 0 || unit.precision > 6) {
    throw new ProductDomainError(PRODUCT_DOMAIN_ERROR_CODES.unitPrecisionInvalid);
  }
  if (
    unit.roundingMode !== "half-up" &&
    unit.roundingMode !== "down" &&
    unit.roundingMode !== "up"
  ) {
    throw new ProductDomainError(PRODUCT_DOMAIN_ERROR_CODES.unitRoundingInvalid);
  }
  if (isBase && unit.ratioToBase !== 1) {
    throw new ProductDomainError(PRODUCT_DOMAIN_ERROR_CODES.baseUnitRatioInvalid);
  }

  return Object.freeze({
    unitId: normalizeRequired(unit.unitId),
    code: normalizeRequired(unit.code).toUpperCase(),
    title: normalizeRequired(unit.title),
    ratioToBase: unit.ratioToBase,
    precision: unit.precision,
    roundingMode: unit.roundingMode,
  });
};

export const createProductUnitProfile = (
  input: CreateProductUnitProfileInput,
): Readonly<ProductUnitProfile> => {
  const base = normalizeUnit({ ...input.baseUnit, ratioToBase: 1 }, true);
  const alternates = (input.alternateUnits ?? []).map((unit) => normalizeUnit(unit, false));
  const units = [base, ...alternates];

  const ids = new Set<string>();
  const codes = new Set<string>();
  for (const unit of units) {
    if (ids.has(unit.unitId) || codes.has(unit.code)) {
      throw new ProductDomainError(PRODUCT_DOMAIN_ERROR_CODES.unitDuplicate);
    }
    ids.add(unit.unitId);
    codes.add(unit.code);
  }

  return Object.freeze({
    baseUnitId: base.unitId,
    units: Object.freeze(units),
  });
};

const roundQuantity = (
  value: number,
  precision: number,
  mode: QuantityRoundingMode,
): number => {
  const factor = 10 ** precision;
  const scaled = value * factor;
  const rounded =
    mode === "down"
      ? Math.trunc(scaled)
      : mode === "up"
        ? (scaled >= 0 ? Math.ceil(scaled) : Math.floor(scaled))
        : (scaled >= 0 ? Math.floor(scaled + 0.5) : Math.ceil(scaled - 0.5));
  return rounded / factor;
};

export const convertProductQuantity = (
  profile: ProductUnitProfile,
  quantity: number,
  fromUnitId: string,
  toUnitId: string,
): number => {
  if (!Number.isFinite(quantity)) {
    throw new ProductDomainError(PRODUCT_DOMAIN_ERROR_CODES.quantityInvalid);
  }
  const from = profile.units.find((unit) => unit.unitId === fromUnitId);
  const to = profile.units.find((unit) => unit.unitId === toUnitId);
  if (!from || !to) {
    throw new ProductDomainError(PRODUCT_DOMAIN_ERROR_CODES.unitNotFound);
  }

  const baseQuantity = quantity * from.ratioToBase;
  const targetQuantity = baseQuantity / to.ratioToBase;
  return roundQuantity(targetQuantity, to.precision, to.roundingMode);
};
