import type { CurrencyCode } from "@argin/platform";
import {
  INVENTORY_VALUATION_METHODS,
  type InventoryCostAmount,
  type InventoryUnitCostAmount,
  type InventoryValuationMethod,
} from "./inventory-valuation.ts";
import { normalizeInventoryQuantity } from "./inventory-quantity.ts";

export const INVENTORY_VALUATION_STRATEGY_VERSION = 1 as const;
export const INVENTORY_VALUATION_ROUNDING_MODE = "half-away-from-zero" as const;
export const INVENTORY_VALUATION_UNIT_COST_SCALE = 12 as const;

export type InventoryValuationRoundingMode = typeof INVENTORY_VALUATION_ROUNDING_MODE;

export type InventoryValuationStrategyErrorCode =
  | "VALUATION_STRATEGY_INPUT_INVALID"
  | "VALUATION_STRATEGY_METHOD_INVALID"
  | "VALUATION_STRATEGY_VERSION_UNSUPPORTED"
  | "VALUATION_STRATEGY_QUANTITY_INVALID"
  | "VALUATION_STRATEGY_UNIT_COST_INVALID"
  | "VALUATION_STRATEGY_AMOUNT_OUT_OF_RANGE"
  | "VALUATION_STRATEGY_INSUFFICIENT_QUANTITY"
  | "VALUATION_STRATEGY_CURRENCY_MISMATCH"
  | "VALUATION_STRATEGY_LAYER_INVALID";

export class InventoryValuationStrategyError extends Error {
  constructor(
    public readonly code: InventoryValuationStrategyErrorCode,
    public readonly field: string,
  ) {
    super(`${code}:${field}`);
    this.name = "InventoryValuationStrategyError";
  }
}

export interface InventoryValuationStrategyIdentity {
  readonly method: InventoryValuationMethod;
  readonly version: number;
  readonly roundingMode: InventoryValuationRoundingMode;
}

export interface InventoryValuationInboundInput {
  readonly quantity: string;
  readonly unitCost: InventoryUnitCostAmount;
  readonly currency: CurrencyCode;
  readonly layerId?: string;
}

export interface InventoryValuationOutboundInput {
  readonly quantity: string;
  readonly currency: CurrencyCode;
}

export interface InventoryFifoLayerState {
  readonly layerId: string;
  readonly remainingQuantity: string;
  readonly remainingCost: InventoryCostAmount;
  readonly currency: CurrencyCode;
}

export interface InventoryFifoState {
  readonly layers: readonly InventoryFifoLayerState[];
}

export interface InventoryFifoConsumption {
  readonly layerId: string;
  readonly quantity: string;
  readonly cost: InventoryCostAmount;
}

export interface InventoryMovingAverageState {
  readonly quantity: string;
  readonly totalCost: InventoryCostAmount;
  readonly currency: CurrencyCode;
}

export interface InventoryValuationInboundResult<TState> {
  readonly state: TState;
  readonly quantity: string;
  readonly unitCost: InventoryUnitCostAmount;
  readonly totalCost: InventoryCostAmount;
  readonly currency: CurrencyCode;
}

export interface InventoryValuationOutboundResult<TState> {
  readonly state: TState;
  readonly quantity: string;
  readonly unitCost: InventoryUnitCostAmount;
  readonly totalCost: InventoryCostAmount;
  readonly currency: CurrencyCode;
}

export interface InventoryFifoOutboundResult extends InventoryValuationOutboundResult<InventoryFifoState> {
  readonly consumptions: readonly InventoryFifoConsumption[];
}

export interface InventoryValuationStrategy<TState, TOutboundResult extends InventoryValuationOutboundResult<TState>> {
  readonly identity: InventoryValuationStrategyIdentity;
  receive(state: TState, input: InventoryValuationInboundInput): InventoryValuationInboundResult<TState>;
  issue(state: TState, input: InventoryValuationOutboundInput): TOutboundResult;
}

type Decimal = {
  readonly coefficient: bigint;
  readonly scale: number;
};

const pow10Cache = new Map<number, bigint>([[0, 1n]]);

function fail(code: InventoryValuationStrategyErrorCode, field: string): never {
  throw new InventoryValuationStrategyError(code, field);
}

function pow10(exponent: number): bigint {
  if (!Number.isSafeInteger(exponent) || exponent < 0) return fail("VALUATION_STRATEGY_INPUT_INVALID", "scale");
  const cached = pow10Cache.get(exponent);
  if (cached !== undefined) return cached;
  const value = 10n ** BigInt(exponent);
  pow10Cache.set(exponent, value);
  return value;
}

function parseUnsignedDecimal(value: string, field: string, allowZero: boolean): Decimal {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value.trim())) {
    return fail(field === "unitCost" ? "VALUATION_STRATEGY_UNIT_COST_INVALID" : "VALUATION_STRATEGY_QUANTITY_INVALID", field);
  }
  const [whole = "0", fraction = ""] = value.trim().split(".");
  const coefficient = BigInt(`${whole}${fraction}`);
  if (!allowZero && coefficient === 0n) return fail("VALUATION_STRATEGY_QUANTITY_INVALID", field);
  return { coefficient, scale: fraction.length };
}

function normalizeQuantity(value: string, field = "quantity", allowZero = false): string {
  let normalized: string;
  try {
    normalized = normalizeInventoryQuantity(value);
  } catch {
    return fail("VALUATION_STRATEGY_QUANTITY_INVALID", field);
  }
  if (normalized.startsWith("-") || (!allowZero && normalized === "0")) {
    return fail("VALUATION_STRATEGY_QUANTITY_INVALID", field);
  }
  return normalized;
}

function canonicalDecimal(decimal: Decimal): string {
  let coefficient = decimal.coefficient;
  let scale = decimal.scale;
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  const digits = coefficient.toString();
  if (scale === 0) return digits;
  if (digits.length <= scale) return `0.${"0".repeat(scale - digits.length)}${digits}`;
  return `${digits.slice(0, digits.length - scale)}.${digits.slice(digits.length - scale)}`;
}

function align(left: Decimal, right: Decimal): readonly [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale);
  return [
    left.coefficient * pow10(scale - left.scale),
    right.coefficient * pow10(scale - right.scale),
    scale,
  ];
}

function addDecimal(left: Decimal, right: Decimal): Decimal {
  const [l, r, scale] = align(left, right);
  return { coefficient: l + r, scale };
}

function subtractDecimal(left: Decimal, right: Decimal, field: string): Decimal {
  const [l, r, scale] = align(left, right);
  if (r > l) return fail("VALUATION_STRATEGY_INSUFFICIENT_QUANTITY", field);
  return { coefficient: l - r, scale };
}

function compareDecimal(left: Decimal, right: Decimal): number {
  const [l, r] = align(left, right);
  return l < r ? -1 : l > r ? 1 : 0;
}

function multiplyDecimal(left: Decimal, right: Decimal): Decimal {
  return { coefficient: left.coefficient * right.coefficient, scale: left.scale + right.scale };
}

function divideRoundHalfAwayFromZero(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) return fail("VALUATION_STRATEGY_INPUT_INVALID", "denominator");
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const quotient = absolute / denominator;
  const remainder = absolute % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

function decimalToRoundedInteger(value: Decimal): bigint {
  return divideRoundHalfAwayFromZero(value.coefficient, pow10(value.scale));
}

function safeMoney(value: bigint, field: string): InventoryCostAmount {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    return fail("VALUATION_STRATEGY_AMOUNT_OUT_OF_RANGE", field);
  }
  return Number(value);
}

function assertMoney(value: number, field: string, allowNegative = false): InventoryCostAmount {
  if (!Number.isSafeInteger(value) || (!allowNegative && value < 0)) {
    return fail("VALUATION_STRATEGY_AMOUNT_OUT_OF_RANGE", field);
  }
  return Object.is(value, -0) ? 0 : value;
}

function canonicalUnitCost(value: string): InventoryUnitCostAmount {
  return canonicalDecimal(parseUnsignedDecimal(value, "unitCost", true));
}

function totalFromQuantityAndUnitCost(quantity: string, unitCost: string): InventoryCostAmount {
  const product = multiplyDecimal(
    parseUnsignedDecimal(quantity, "quantity", false),
    parseUnsignedDecimal(unitCost, "unitCost", true),
  );
  return safeMoney(decimalToRoundedInteger(product), "totalCost");
}

function proratedMoney(totalCost: number, part: Decimal, whole: Decimal): InventoryCostAmount {
  if (compareDecimal(part, whole) > 0) return fail("VALUATION_STRATEGY_INSUFFICIENT_QUANTITY", "quantity");
  const [partCoefficient, wholeCoefficient] = align(part, whole);
  const result = divideRoundHalfAwayFromZero(BigInt(totalCost) * partCoefficient, wholeCoefficient);
  return safeMoney(result, "totalCost");
}

function unitCostFromMoneyAndQuantity(totalCost: number, quantity: string): InventoryUnitCostAmount {
  const parsedQuantity = parseUnsignedDecimal(quantity, "quantity", false);
  const numerator = BigInt(totalCost) * pow10(parsedQuantity.scale + INVENTORY_VALUATION_UNIT_COST_SCALE);
  const coefficient = divideRoundHalfAwayFromZero(numerator, parsedQuantity.coefficient);
  return canonicalDecimal({ coefficient, scale: INVENTORY_VALUATION_UNIT_COST_SCALE });
}

function assertCurrency(expected: CurrencyCode | null, actual: CurrencyCode): CurrencyCode {
  if (typeof actual !== "string" || !actual.trim()) return fail("VALUATION_STRATEGY_INPUT_INVALID", "currency");
  if (expected !== null && expected !== actual) return fail("VALUATION_STRATEGY_CURRENCY_MISMATCH", "currency");
  return actual;
}

function assertVersion(version: number): number {
  if (version !== INVENTORY_VALUATION_STRATEGY_VERSION) {
    return fail("VALUATION_STRATEGY_VERSION_UNSUPPORTED", "version");
  }
  return version;
}

export function createInventoryValuationStrategyIdentity(method: InventoryValuationMethod, version: number = INVENTORY_VALUATION_STRATEGY_VERSION): InventoryValuationStrategyIdentity {
  if (!INVENTORY_VALUATION_METHODS.includes(method)) return fail("VALUATION_STRATEGY_METHOD_INVALID", "method");
  return Object.freeze({
    method,
    version: assertVersion(version),
    roundingMode: INVENTORY_VALUATION_ROUNDING_MODE,
  });
}

function normalizeFifoState(state: InventoryFifoState): InventoryFifoState {
  if (!state || !Array.isArray(state.layers)) return fail("VALUATION_STRATEGY_INPUT_INVALID", "state");
  const layers = state.layers.map((layer, index) => {
    if (!layer || typeof layer.layerId !== "string" || !layer.layerId.trim()) return fail("VALUATION_STRATEGY_LAYER_INVALID", `layers[${index}].layerId`);
    const remainingQuantity = normalizeQuantity(layer.remainingQuantity, `layers[${index}].remainingQuantity`, true);
    const remainingCost = assertMoney(layer.remainingCost, `layers[${index}].remainingCost`);
    if (remainingQuantity === "0" && remainingCost !== 0) return fail("VALUATION_STRATEGY_LAYER_INVALID", `layers[${index}]`);
    return Object.freeze({ ...layer, layerId: layer.layerId.trim(), remainingQuantity, remainingCost });
  });
  return Object.freeze({ layers: Object.freeze(layers) });
}

export const fifoInventoryValuationStrategy = Object.freeze<InventoryValuationStrategy<InventoryFifoState, InventoryFifoOutboundResult>>({
  identity: createInventoryValuationStrategyIdentity("fifo"),

  receive(state, input) {
    const normalized = normalizeFifoState(state);
    const quantity = normalizeQuantity(input.quantity);
    const unitCost = canonicalUnitCost(input.unitCost);
    const currency = assertCurrency(normalized.layers[0]?.currency ?? null, input.currency);
    for (const layer of normalized.layers) assertCurrency(currency, layer.currency);
    const totalCost = totalFromQuantityAndUnitCost(quantity, unitCost);
    const layerId = input.layerId?.trim();
    if (!layerId) return fail("VALUATION_STRATEGY_LAYER_INVALID", "layerId");
    if (normalized.layers.some((layer) => layer.layerId === layerId)) return fail("VALUATION_STRATEGY_LAYER_INVALID", "layerId");

    const nextLayer = Object.freeze({ layerId, remainingQuantity: quantity, remainingCost: totalCost, currency });
    return Object.freeze({
      state: Object.freeze({ layers: Object.freeze([...normalized.layers, nextLayer]) }),
      quantity,
      unitCost,
      totalCost,
      currency,
    });
  },

  issue(state, input) {
    const normalized = normalizeFifoState(state);
    const quantity = normalizeQuantity(input.quantity);
    const currency = assertCurrency(normalized.layers[0]?.currency ?? null, input.currency);
    for (const layer of normalized.layers) assertCurrency(currency, layer.currency);

    const requested = parseUnsignedDecimal(quantity, "quantity", false);
    const available = normalized.layers.reduce(
      (sum, layer) => addDecimal(sum, parseUnsignedDecimal(layer.remainingQuantity, "remainingQuantity", true)),
      { coefficient: 0n, scale: 0 } as Decimal,
    );
    if (compareDecimal(requested, available) > 0) return fail("VALUATION_STRATEGY_INSUFFICIENT_QUANTITY", "quantity");

    let remaining = requested;
    let totalCost = 0;
    const consumptions: InventoryFifoConsumption[] = [];
    const nextLayers: InventoryFifoLayerState[] = [];

    for (const layer of normalized.layers) {
      const layerQuantity = parseUnsignedDecimal(layer.remainingQuantity, "remainingQuantity", true);
      if (remaining.coefficient === 0n || layerQuantity.coefficient === 0n) {
        if (layerQuantity.coefficient !== 0n) nextLayers.push(layer);
        continue;
      }

      const consume = compareDecimal(remaining, layerQuantity) >= 0 ? layerQuantity : remaining;
      const consumeAllLayer = compareDecimal(consume, layerQuantity) === 0;
      const cost = consumeAllLayer ? layer.remainingCost : proratedMoney(layer.remainingCost, consume, layerQuantity);
      totalCost = assertMoney(totalCost + cost, "totalCost");
      const consumeQuantity = canonicalDecimal(consume);
      consumptions.push(Object.freeze({ layerId: layer.layerId, quantity: consumeQuantity, cost }));

      const layerRemaining = subtractDecimal(layerQuantity, consume, "quantity");
      remaining = subtractDecimal(remaining, consume, "quantity");
      if (layerRemaining.coefficient !== 0n) {
        nextLayers.push(Object.freeze({
          ...layer,
          remainingQuantity: canonicalDecimal(layerRemaining),
          remainingCost: layer.remainingCost - cost,
        }));
      }
    }

    const unitCost = unitCostFromMoneyAndQuantity(totalCost, quantity);
    return Object.freeze({
      state: Object.freeze({ layers: Object.freeze(nextLayers) }),
      quantity,
      unitCost,
      totalCost: -totalCost,
      currency,
      consumptions: Object.freeze(consumptions),
    });
  },
});

function normalizeMovingAverageState(state: InventoryMovingAverageState): InventoryMovingAverageState {
  if (!state || typeof state !== "object") return fail("VALUATION_STRATEGY_INPUT_INVALID", "state");
  const quantity = normalizeQuantity(state.quantity, "state.quantity", true);
  const totalCost = assertMoney(state.totalCost, "state.totalCost");
  if (quantity === "0" && totalCost !== 0) return fail("VALUATION_STRATEGY_INPUT_INVALID", "state.totalCost");
  return Object.freeze({ quantity, totalCost, currency: state.currency });
}

export const movingAverageInventoryValuationStrategy = Object.freeze<InventoryValuationStrategy<InventoryMovingAverageState, InventoryValuationOutboundResult<InventoryMovingAverageState>>>({
  identity: createInventoryValuationStrategyIdentity("moving_average"),

  receive(state, input) {
    const normalized = normalizeMovingAverageState(state);
    const quantity = normalizeQuantity(input.quantity);
    const unitCost = canonicalUnitCost(input.unitCost);
    const currency = assertCurrency(normalized.quantity === "0" ? null : normalized.currency, input.currency);
    const inboundCost = totalFromQuantityAndUnitCost(quantity, unitCost);
    const nextQuantity = addDecimal(
      parseUnsignedDecimal(normalized.quantity, "state.quantity", true),
      parseUnsignedDecimal(quantity, "quantity", false),
    );
    const nextTotalCost = assertMoney(normalized.totalCost + inboundCost, "state.totalCost");

    return Object.freeze({
      state: Object.freeze({ quantity: canonicalDecimal(nextQuantity), totalCost: nextTotalCost, currency }),
      quantity,
      unitCost,
      totalCost: inboundCost,
      currency,
    });
  },

  issue(state, input) {
    const normalized = normalizeMovingAverageState(state);
    const quantity = normalizeQuantity(input.quantity);
    const currency = assertCurrency(normalized.currency, input.currency);
    const available = parseUnsignedDecimal(normalized.quantity, "state.quantity", true);
    const requested = parseUnsignedDecimal(quantity, "quantity", false);
    if (compareDecimal(requested, available) > 0) return fail("VALUATION_STRATEGY_INSUFFICIENT_QUANTITY", "quantity");

    const issueCost = compareDecimal(requested, available) === 0
      ? normalized.totalCost
      : proratedMoney(normalized.totalCost, requested, available);
    const nextQuantity = subtractDecimal(available, requested, "quantity");
    const nextTotalCost = normalized.totalCost - issueCost;
    const unitCost = unitCostFromMoneyAndQuantity(issueCost, quantity);

    return Object.freeze({
      state: Object.freeze({
        quantity: canonicalDecimal(nextQuantity),
        totalCost: nextQuantity.coefficient === 0n ? 0 : nextTotalCost,
        currency,
      }),
      quantity,
      unitCost,
      totalCost: -issueCost,
      currency,
    });
  },
});

export function getInventoryValuationStrategy(method: InventoryValuationMethod, version: number = INVENTORY_VALUATION_STRATEGY_VERSION) {
  assertVersion(version);
  if (method === "fifo") return fifoInventoryValuationStrategy;
  if (method === "moving_average") return movingAverageInventoryValuationStrategy;
  return fail("VALUATION_STRATEGY_METHOD_INVALID", "method");
}
