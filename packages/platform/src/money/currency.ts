export type CurrencyCode = string;

export interface CurrencyDefinition {
  readonly code: CurrencyCode;
  readonly numericCode?: string;
  readonly decimalDigits: number;
}

export const IRR: CurrencyDefinition = Object.freeze({
  code: "IRR",
  numericCode: "364",
  decimalDigits: 0,
});

export function normalizeCurrencyCode(
  currency: CurrencyCode,
): CurrencyCode {
  const normalized = currency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new TypeError(
      "Currency code must be a three-letter ISO 4217 code.",
    );
  }

  return normalized;
}
