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
function safeNumber(value: bigint, field: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) return fail(field);
  return Number(value);
}
function roundHalfAwayFromZero(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}
function decimal(value: number, field: string): { coefficient: bigint; scale: number } {
  if (!Number.isFinite(value) || value <= 0) return fail(field);
  const text = value.toString();
  if (/e/i.test(text)) return fail(field);
  const [whole = "0", fraction = ""] = text.split(".");
  return { coefficient: BigInt(whole + fraction), scale: fraction.length };
}
function percent(base: number, basisPoints: number, field: string): number {
  return safeNumber(roundHalfAwayFromZero(BigInt(base) * BigInt(basisPoints), 10_000n), field);
}
function adjustment(mode: SalesAdjustmentMode, value: number, base: number, field: string): number {
  return mode === "amount" ? value : percent(base, value, field);
}

export function calculateSalesLineTotals(terms: SalesCommercialTerms): SalesLineTotals {
  const quantity = decimal(terms.quantity, "commercialTerms.quantity");
  const grossAmount = safeNumber(
    roundHalfAwayFromZero(quantity.coefficient * BigInt(terms.unitPrice), 10n ** BigInt(quantity.scale)),
    "grossAmount",
  );

  let current = grossAmount;
  let discountAmount = 0;
  for (let index = 0; index < terms.discounts.length; index += 1) {
    const discount: SalesDiscount = terms.discounts[index]!;
    const amount = adjustment(discount.mode, discount.value, current, `discounts[${index}]`);
    if (amount > current) return fail(`discounts[${index}]`);
    discountAmount = safeNumber(BigInt(discountAmount) + BigInt(amount), "discountAmount");
    current -= amount;
  }
  const netAfterDiscount = current;

  let chargeAmount = 0;
  for (let index = 0; index < terms.charges.length; index += 1) {
    const charge: SalesCharge = terms.charges[index]!;
    const amount = adjustment(charge.mode, charge.value, current, `charges[${index}]`);
    chargeAmount = safeNumber(BigInt(chargeAmount) + BigInt(amount), "chargeAmount");
    current = safeNumber(BigInt(current) + BigInt(amount), "taxBaseAmount");
  }
  const taxBaseAmount = current;

  let taxAmount = 0;
  for (let index = 0; index < terms.taxes.length; index += 1) {
    const tax: SalesTax = terms.taxes[index]!;
    taxAmount = safeNumber(BigInt(taxAmount) + BigInt(percent(taxBaseAmount, tax.rateBasisPoints, `taxes[${index}]`)), "taxAmount");
  }
  const grandTotal = safeNumber(BigInt(taxBaseAmount) + BigInt(taxAmount), "grandTotal");

  return Object.freeze({ currency: terms.currency, grossAmount, discountAmount, netAfterDiscount, chargeAmount, taxBaseAmount, taxAmount, grandTotal });
}

export function calculateSalesDocumentTotals(lines: readonly SalesLineTotals[]): SalesDocumentTotals {
  if (lines.length === 0) return Object.freeze({ currency: "", grossAmount: 0, discountAmount: 0, netAfterDiscount: 0, chargeAmount: 0, taxBaseAmount: 0, taxAmount: 0, grandTotal: 0, lineCount: 0 });
  const currency = lines[0]!.currency;
  let gross=0n, discount=0n, net=0n, charge=0n, taxBase=0n, tax=0n, grand=0n;
  for (let index=0; index<lines.length; index+=1) {
    const line=lines[index]!;
    if (line.currency !== currency) throw new SalesDomainError(SALES_DOMAIN_ERROR_CODES.currencyMismatch, `lines[${index}].currency`);
    gross+=BigInt(line.grossAmount); discount+=BigInt(line.discountAmount); net+=BigInt(line.netAfterDiscount);
    charge+=BigInt(line.chargeAmount); taxBase+=BigInt(line.taxBaseAmount); tax+=BigInt(line.taxAmount); grand+=BigInt(line.grandTotal);
  }
  return Object.freeze({ currency, grossAmount:safeNumber(gross,"document.grossAmount"), discountAmount:safeNumber(discount,"document.discountAmount"), netAfterDiscount:safeNumber(net,"document.netAfterDiscount"), chargeAmount:safeNumber(charge,"document.chargeAmount"), taxBaseAmount:safeNumber(taxBase,"document.taxBaseAmount"), taxAmount:safeNumber(tax,"document.taxAmount"), grandTotal:safeNumber(grand,"document.grandTotal"), lineCount:lines.length });
}
