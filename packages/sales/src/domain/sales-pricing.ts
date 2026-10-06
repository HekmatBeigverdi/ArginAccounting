import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./sales-domain-errors.ts";
import type { SalesAdjustmentMode, SalesCharge, SalesDiscount, SalesTax } from "./sales-adjustments.ts";
import type { SalesCommercialTerms } from "./sales-commercial-terms.ts";

export const SALES_MONEY_ROUNDING_MODE = "half-away-from-zero" as const;

export interface SalesLineTotals {
  readonly currency: string;
  readonly grossAmount: number;
  readonly discountAmount: number;
  readonly netAfterDiscount: number;
  readonly chargeAmount: number;
  readonly taxBaseAmount: number;
  readonly taxAmount: number;
  readonly grandTotal: number;
}

export interface SalesDocumentTotals extends SalesLineTotals {
  readonly lineCount: number;
}

function fail(field: string): never {
  throw new SalesDomainError(SALES_DOMAIN_ERROR_CODES.pricingCalculationInvalid, field);
}

function toSafeNumber(value: bigint, field: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    return fail(field);
  }
  return Number(value);
}

function roundHalfAwayFromZero(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

function parseQuantity(value: number, field: string): { coefficient: bigint; scale: number } {
  if (!Number.isFinite(value) || value <= 0) return fail(field);
  const text = value.toString();
  if (/e/i.test(text)) return fail(field);
  const [whole = "0", fraction = ""] = text.split(".");
  return { coefficient: BigInt(whole + fraction), scale: fraction.length };
}

function calculatePercentageAmount(base: number, basisPoints: number, field: string): number {
  return toSafeNumber(roundHalfAwayFromZero(BigInt(base) * BigInt(basisPoints), 10_000n), field);
}

function calculateAdjustmentAmount(mode: SalesAdjustmentMode, value: number, base: number, field: string): number {
  return mode === "amount" ? value : calculatePercentageAmount(base, value, field);
}

export function calculateSalesLineTotals(terms: SalesCommercialTerms): SalesLineTotals {
  const quantity = parseQuantity(terms.quantity, "commercialTerms.quantity");
  const unroundedGrossAmount = quantity.coefficient * BigInt(terms.unitPrice);
  const quantityDivisor = 10n ** BigInt(quantity.scale);
  const grossAmount = toSafeNumber(
    roundHalfAwayFromZero(unroundedGrossAmount, quantityDivisor),
    "grossAmount",
  );

  // Apply discounts in order, each against the remaining amount.
  let runningAmount = grossAmount;
  let discountAmount = 0;
  for (let index = 0; index < terms.discounts.length; index += 1) {
    const discount: SalesDiscount = terms.discounts[index]!;
    const amount = calculateAdjustmentAmount(discount.mode, discount.value, runningAmount, `discounts[${index}]`);
    if (amount > runningAmount) return fail(`discounts[${index}]`);
    discountAmount = toSafeNumber(BigInt(discountAmount) + BigInt(amount), "discountAmount");
    runningAmount -= amount;
  }
  const netAfterDiscount = runningAmount;

  // Apply charges in order, including earlier charges in the percentage base.
  let chargeAmount = 0;
  for (let index = 0; index < terms.charges.length; index += 1) {
    const charge: SalesCharge = terms.charges[index]!;
    const amount = calculateAdjustmentAmount(charge.mode, charge.value, runningAmount, `charges[${index}]`);
    chargeAmount = toSafeNumber(BigInt(chargeAmount) + BigInt(amount), "chargeAmount");
    runningAmount = toSafeNumber(BigInt(runningAmount) + BigInt(amount), "taxBaseAmount");
  }
  const taxBaseAmount = runningAmount;

  // Each tax uses the same base after all discounts and charges.
  let taxAmount = 0;
  for (let index = 0; index < terms.taxes.length; index += 1) {
    const tax: SalesTax = terms.taxes[index]!;
    const amount = calculatePercentageAmount(taxBaseAmount, tax.rateBasisPoints, `taxes[${index}]`);
    taxAmount = toSafeNumber(BigInt(taxAmount) + BigInt(amount), "taxAmount");
  }
  const grandTotal = toSafeNumber(BigInt(taxBaseAmount) + BigInt(taxAmount), "grandTotal");

  return Object.freeze({
    currency: terms.currency,
    grossAmount,
    discountAmount,
    netAfterDiscount,
    chargeAmount,
    taxBaseAmount,
    taxAmount,
    grandTotal,
  });
}

export function calculateSalesDocumentTotals(lines: readonly SalesLineTotals[]): SalesDocumentTotals {
  if (lines.length === 0) {
    return Object.freeze({
      currency: "",
      grossAmount: 0,
      discountAmount: 0,
      netAfterDiscount: 0,
      chargeAmount: 0,
      taxBaseAmount: 0,
      taxAmount: 0,
      grandTotal: 0,
      lineCount: 0,
    });
  }

  const currency = lines[0]!.currency;
  let grossAmount = 0n;
  let discountAmount = 0n;
  let netAfterDiscount = 0n;
  let chargeAmount = 0n;
  let taxBaseAmount = 0n;
  let taxAmount = 0n;
  let grandTotal = 0n;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line.currency !== currency) {
      throw new SalesDomainError(
        SALES_DOMAIN_ERROR_CODES.currencyMismatch,
        `lines[${index}].currency`,
      );
    }

    grossAmount += BigInt(line.grossAmount);
    discountAmount += BigInt(line.discountAmount);
    netAfterDiscount += BigInt(line.netAfterDiscount);
    chargeAmount += BigInt(line.chargeAmount);
    taxBaseAmount += BigInt(line.taxBaseAmount);
    taxAmount += BigInt(line.taxAmount);
    grandTotal += BigInt(line.grandTotal);
  }

  return Object.freeze({
    currency,
    grossAmount: toSafeNumber(grossAmount, "document.grossAmount"),
    discountAmount: toSafeNumber(discountAmount, "document.discountAmount"),
    netAfterDiscount: toSafeNumber(netAfterDiscount, "document.netAfterDiscount"),
    chargeAmount: toSafeNumber(chargeAmount, "document.chargeAmount"),
    taxBaseAmount: toSafeNumber(taxBaseAmount, "document.taxBaseAmount"),
    taxAmount: toSafeNumber(taxAmount, "document.taxAmount"),
    grandTotal: toSafeNumber(grandTotal, "document.grandTotal"),
    lineCount: lines.length,
  });
}
