import {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
} from "./purchase-domain-errors.ts";
import type { PurchaseDomainErrorCode } from "./purchase-domain-errors.ts";

export type PurchaseCurrencyCode = string;

export interface PurchaseMoneySnapshot {
  readonly amount: number;
  readonly currency: PurchaseCurrencyCode;
}

export type PurchaseMoneyRoundingMode = "half-away-from-zero";

export type PurchaseQuantityRoundingMode = "half-up" | "down" | "up";

export type PurchaseTaxTreatment =
  "unspecified" | "taxable" | "exempt" | "not-subject";

export interface PurchaseCommercialUnitSnapshot {
  readonly unitId: string;
  readonly code: string;
  readonly title: string;
  readonly ratioToBase: string;
  readonly precision: number;
  readonly roundingMode: PurchaseQuantityRoundingMode;
  readonly taxpayerUnitCode: string | null;
}

export interface PurchaseQuantitySnapshot {
  readonly enteredQuantity: string;
  readonly baseQuantity: string;
  readonly enteredUnit: PurchaseCommercialUnitSnapshot;
  readonly baseUnit: PurchaseCommercialUnitSnapshot;
}

export type PurchaseAdjustment = Readonly<
  | { kind: "fixed"; amount: PurchaseMoneySnapshot }
  | { kind: "percentage"; rateBasisPoints: number }
>;

export interface PurchaseTaxSemantics {
  readonly treatment: PurchaseTaxTreatment;
  readonly rateBasisPoints: number | null;
}

export interface PurchaseCommercialTerms {
  readonly quantity: PurchaseQuantitySnapshot;
  readonly unitPrice: PurchaseMoneySnapshot;
  readonly discounts: readonly PurchaseAdjustment[];
  readonly charges: readonly PurchaseAdjustment[];
  readonly tax: PurchaseTaxSemantics;
  readonly moneyRoundingMode: PurchaseMoneyRoundingMode;
}

export interface CreatePurchaseCommercialTermsInput {
  readonly enteredQuantity: string;
  readonly enteredUnit: PurchaseCommercialUnitSnapshot;
  readonly baseUnit: PurchaseCommercialUnitSnapshot;
  readonly unitPrice: PurchaseMoneySnapshot;
  readonly discounts?: readonly PurchaseAdjustment[];
  readonly charges?: readonly PurchaseAdjustment[];
  readonly tax: PurchaseTaxSemantics;
}

type Decimal = { coefficient: bigint; scale: number };

const fail = (code: PurchaseDomainErrorCode, field: string): never => {
  throw new PurchaseDomainError(code, field);
};

const powerOfTen = (scale: number): bigint => 10n ** BigInt(scale);

export function normalizePurchaseQuantity(value: string): string {
  if (
    typeof value !== "string" ||
    value.length > 128 ||
    !/^\d+(?:\.\d+)?$/u.test(value.trim())
  ) {
    return fail(
      PURCHASE_DOMAIN_ERROR_CODES.quantityInvalid,
      "commercialTerms.enteredQuantity",
    );
  }
  const [wholeRaw = "", fractionRaw = ""] = value.trim().split(".");
  const whole = wholeRaw.replace(/^0+(?=\d)/u, "");
  const fraction = fractionRaw.replace(/0+$/u, "");
  if (whole.length > 36 || fraction.length > 18) {
    return fail(
      PURCHASE_DOMAIN_ERROR_CODES.quantityInvalid,
      "commercialTerms.enteredQuantity",
    );
  }
  return whole + (fraction ? `.${fraction}` : "");
}

const parseQuantityDecimal = (value: string): Decimal => {
  const canonical = normalizePurchaseQuantity(value);
  const [whole = "0", fraction = ""] = canonical.split(".");
  return { coefficient: BigInt(whole + fraction), scale: fraction.length };
};

const formatQuantityDecimal = (coefficient: bigint, scale: number): string => {
  const digits = coefficient.toString().padStart(scale + 1, "0");
  return normalizePurchaseQuantity(
    scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits,
  );
};

const requiredUnitText = (value: string, field: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.unitInvalid, field);
  }
  return value.trim();
};

function normalizeUnit(
  input: PurchaseCommercialUnitSnapshot,
  field: string,
): PurchaseCommercialUnitSnapshot {
  if (
    !input ||
    typeof input !== "object" ||
    !Number.isInteger(input.precision) ||
    input.precision < 0 ||
    input.precision > 6 ||
    !["half-up", "down", "up"].includes(input.roundingMode)
  ) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.unitInvalid, field);
  }
  const ratioToBase = normalizePurchaseQuantity(input.ratioToBase);
  if (parseQuantityDecimal(ratioToBase).coefficient <= 0n) {
    return fail(
      PURCHASE_DOMAIN_ERROR_CODES.unitInvalid,
      `${field}.ratioToBase`,
    );
  }
  return Object.freeze({
    unitId: requiredUnitText(input.unitId, `${field}.unitId`),
    code: requiredUnitText(input.code, `${field}.code`).toUpperCase(),
    title: requiredUnitText(input.title, `${field}.title`),
    ratioToBase,
    precision: input.precision,
    roundingMode: input.roundingMode,
    taxpayerUnitCode:
      input.taxpayerUnitCode == null
        ? null
        : requiredUnitText(input.taxpayerUnitCode, `${field}.taxpayerUnitCode`),
  });
}

function convertToBaseQuantity(
  quantityText: string,
  enteredUnit: PurchaseCommercialUnitSnapshot,
  baseUnit: PurchaseCommercialUnitSnapshot,
): string {
  const quantity = parseQuantityDecimal(quantityText);
  if (quantity.coefficient <= 0n) {
    return fail(
      PURCHASE_DOMAIN_ERROR_CODES.quantityInvalid,
      "commercialTerms.enteredQuantity",
    );
  }
  if (quantity.scale > enteredUnit.precision) {
    return fail(
      PURCHASE_DOMAIN_ERROR_CODES.quantityPrecisionInvalid,
      "commercialTerms.enteredQuantity",
    );
  }
  if (baseUnit.ratioToBase !== "1") {
    return fail(
      PURCHASE_DOMAIN_ERROR_CODES.unitInvalid,
      "commercialTerms.baseUnit.ratioToBase",
    );
  }
  const ratio = parseQuantityDecimal(enteredUnit.ratioToBase);
  // Scale the exact product to base-unit precision before rounding.
  const numerator =
    quantity.coefficient * ratio.coefficient * powerOfTen(baseUnit.precision);
  const denominator = powerOfTen(quantity.scale + ratio.scale);
  let scaledBaseQuantity = numerator / denominator;
  const remainder = numerator % denominator;
  const shouldRoundUp =
    (baseUnit.roundingMode === "up" && remainder !== 0n) ||
    (baseUnit.roundingMode === "half-up" && remainder * 2n >= denominator);

  if (shouldRoundUp) {
    scaledBaseQuantity += 1n;
  }
  if (scaledBaseQuantity <= 0n) {
    return fail(
      PURCHASE_DOMAIN_ERROR_CODES.quantityInvalid,
      "commercialTerms.baseQuantity",
    );
  }
  return formatQuantityDecimal(scaledBaseQuantity, baseUnit.precision);
}

function normalizeCurrency(
  currency: PurchaseCurrencyCode,
): PurchaseCurrencyCode {
  const normalized = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/u.test(normalized)) {
    return fail(
      PURCHASE_DOMAIN_ERROR_CODES.moneyInvalid,
      "commercialTerms.currency",
    );
  }
  return normalized;
}

function normalizeMoney(
  value: PurchaseMoneySnapshot,
  field: string,
  currency?: PurchaseCurrencyCode,
): PurchaseMoneySnapshot {
  if (!value || !Number.isSafeInteger(value.amount) || value.amount < 0) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.moneyInvalid, `${field}.amount`);
  }
  const normalizedCurrency = normalizeCurrency(value.currency);
  if (currency && normalizedCurrency !== currency) {
    return fail(
      PURCHASE_DOMAIN_ERROR_CODES.currencyMismatch,
      `${field}.currency`,
    );
  }
  return Object.freeze({ amount: value.amount, currency: normalizedCurrency });
}

function normalizeBasisPointRate(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 10000) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.adjustmentInvalid, field);
  }
  return value;
}

function normalizeAdjustment(
  value: PurchaseAdjustment,
  field: string,
  currency: PurchaseCurrencyCode,
): PurchaseAdjustment {
  if (!value || typeof value !== "object") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.adjustmentInvalid, field);
  }
  if (value.kind === "fixed") {
    return Object.freeze({
      kind: "fixed",
      amount: normalizeMoney(value.amount, `${field}.amount`, currency),
    });
  }
  if (value.kind === "percentage") {
    return Object.freeze({
      kind: "percentage",
      rateBasisPoints: normalizeBasisPointRate(
        value.rateBasisPoints,
        `${field}.rateBasisPoints`,
      ),
    });
  }
  return fail(PURCHASE_DOMAIN_ERROR_CODES.adjustmentInvalid, `${field}.kind`);
}

function normalizeTax(input: PurchaseTaxSemantics): PurchaseTaxSemantics {
  const allowedTreatments: readonly PurchaseTaxTreatment[] = [
    "unspecified",
    "taxable",
    "exempt",
    "not-subject",
  ];
  if (!input || !allowedTreatments.includes(input.treatment)) {
    return fail(
      PURCHASE_DOMAIN_ERROR_CODES.taxSemanticsInvalid,
      "commercialTerms.tax.treatment",
    );
  }
  if (input.treatment === "taxable") {
    if (
      input.rateBasisPoints === null ||
      !Number.isInteger(input.rateBasisPoints) ||
      input.rateBasisPoints < 0 ||
      input.rateBasisPoints > 10000
    ) {
      return fail(
        PURCHASE_DOMAIN_ERROR_CODES.taxSemanticsInvalid,
        "commercialTerms.tax.rateBasisPoints",
      );
    }
  } else if (input.rateBasisPoints !== null) {
    return fail(
      PURCHASE_DOMAIN_ERROR_CODES.taxSemanticsInvalid,
      "commercialTerms.tax.rateBasisPoints",
    );
  }
  return Object.freeze({
    treatment: input.treatment,
    rateBasisPoints: input.rateBasisPoints,
  });
}

export function createPurchaseCommercialTerms(
  input: CreatePurchaseCommercialTermsInput,
): PurchaseCommercialTerms {
  const enteredUnit = normalizeUnit(
    input.enteredUnit,
    "commercialTerms.enteredUnit",
  );
  const baseUnit = normalizeUnit(input.baseUnit, "commercialTerms.baseUnit");
  const enteredQuantity = normalizePurchaseQuantity(input.enteredQuantity);
  const baseQuantity = convertToBaseQuantity(
    enteredQuantity,
    enteredUnit,
    baseUnit,
  );
  const unitPrice = normalizeMoney(
    input.unitPrice,
    "commercialTerms.unitPrice",
  );
  const currency = unitPrice.currency;
  return Object.freeze({
    quantity: Object.freeze({
      enteredQuantity,
      baseQuantity,
      enteredUnit,
      baseUnit,
    }),
    unitPrice,
    discounts: Object.freeze(
      (input.discounts ?? []).map((value, index) =>
        normalizeAdjustment(
          value,
          `commercialTerms.discounts[${index}]`,
          currency,
        ),
      ),
    ),
    charges: Object.freeze(
      (input.charges ?? []).map((value, index) =>
        normalizeAdjustment(
          value,
          `commercialTerms.charges[${index}]`,
          currency,
        ),
      ),
    ),
    tax: normalizeTax(input.tax),
    moneyRoundingMode: "half-away-from-zero",
  });
}
