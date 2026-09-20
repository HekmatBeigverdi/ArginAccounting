import {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
} from "./purchase-domain-errors.ts";
import type {
  PurchaseAdjustment,
  PurchaseCommercialTerms,
} from "./purchase-commercial-semantics.ts";

export interface PurchaseLineTotals {
  readonly currency: string;
  readonly grossAmount: number;
  readonly discountAmount: number;
  readonly netAfterDiscount: number;
  readonly chargeAmount: number;
  readonly taxBaseAmount: number;
  readonly taxAmount: number;
  readonly grandTotal: number;
}

export interface PurchaseDocumentTotals extends PurchaseLineTotals {
  readonly lineCount: number;
}

const fail = (field: string): never => {
  throw new PurchaseDomainError(
    PURCHASE_DOMAIN_ERROR_CODES.pricingInvalid,
    field,
  );
};

function safeNumber(value: bigint, field: string): number {
  if (
    value > BigInt(Number.MAX_SAFE_INTEGER) ||
    value < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    return fail(field);
  }
  return Number(value);
}

function roundHalfAwayFromZero(
  numerator: bigint,
  denominator: bigint,
): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

function parsePositiveDecimal(value: string): { coefficient: bigint; scale: number } {
  if (!/^\d+(?:\.\d+)?$/u.test(value)) {
    return fail("commercialTerms.quantity.enteredQuantity");
  }
  const [whole = "0", fraction = ""] = value.split(".");
  return {
    coefficient: BigInt(whole + fraction),
    scale: fraction.length,
  };
}

function percentageAmount(
  baseAmount: number,
  rateBasisPoints: number,
  field: string,
): number {
  return safeNumber(
    roundHalfAwayFromZero(
      BigInt(baseAmount) * BigInt(rateBasisPoints),
      10_000n,
    ),
    field,
  );
}

function adjustmentAmount(
  adjustment: PurchaseAdjustment,
  baseAmount: number,
  currency: string,
  field: string,
): number {
  if (adjustment.kind === "fixed") {
    if (adjustment.amount.currency !== currency) {
      throw new PurchaseDomainError(
        PURCHASE_DOMAIN_ERROR_CODES.currencyMismatch,
        `${field}.amount.currency`,
      );
    }
    return adjustment.amount.amount;
  }
  return percentageAmount(
    baseAmount,
    adjustment.rateBasisPoints,
    field,
  );
}

export function calculatePurchaseLineTotals(
  terms: PurchaseCommercialTerms,
): PurchaseLineTotals {
  const quantity = parsePositiveDecimal(terms.quantity.enteredQuantity);
  const grossAmount = safeNumber(
    roundHalfAwayFromZero(
      quantity.coefficient * BigInt(terms.unitPrice.amount),
      10n ** BigInt(quantity.scale),
    ),
    "grossAmount",
  );

  let currentAmount = grossAmount;
  let discountAmount = 0;

  for (let index = 0; index < terms.discounts.length; index += 1) {
    const adjustment = terms.discounts[index]!;
    const amount = adjustmentAmount(
      adjustment,
      currentAmount,
      terms.unitPrice.currency,
      `discounts[${index}]`,
    );
    if (amount > currentAmount) {
      return fail(`discounts[${index}]`);
    }
    discountAmount = safeNumber(
      BigInt(discountAmount) + BigInt(amount),
      "discountAmount",
    );
    currentAmount -= amount;
  }

  const netAfterDiscount = currentAmount;
  let chargeAmount = 0;

  for (let index = 0; index < terms.charges.length; index += 1) {
    const adjustment = terms.charges[index]!;
    const amount = adjustmentAmount(
      adjustment,
      currentAmount,
      terms.unitPrice.currency,
      `charges[${index}]`,
    );
    chargeAmount = safeNumber(
      BigInt(chargeAmount) + BigInt(amount),
      "chargeAmount",
    );
    currentAmount = safeNumber(
      BigInt(currentAmount) + BigInt(amount),
      "taxBaseAmount",
    );
  }

  const taxBaseAmount = currentAmount;
  const taxAmount =
    terms.tax.treatment === "taxable"
      ? percentageAmount(
          taxBaseAmount,
          terms.tax.rateBasisPoints ?? 0,
          "taxAmount",
        )
      : 0;
  const grandTotal = safeNumber(
    BigInt(taxBaseAmount) + BigInt(taxAmount),
    "grandTotal",
  );

  return Object.freeze({
    currency: terms.unitPrice.currency,
    grossAmount,
    discountAmount,
    netAfterDiscount,
    chargeAmount,
    taxBaseAmount,
    taxAmount,
    grandTotal,
  });
}

export function calculatePurchaseDocumentTotals(
  lines: readonly PurchaseLineTotals[],
): PurchaseDocumentTotals {
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
      throw new PurchaseDomainError(
        PURCHASE_DOMAIN_ERROR_CODES.currencyMismatch,
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
    grossAmount: safeNumber(grossAmount, "document.grossAmount"),
    discountAmount: safeNumber(discountAmount, "document.discountAmount"),
    netAfterDiscount: safeNumber(netAfterDiscount, "document.netAfterDiscount"),
    chargeAmount: safeNumber(chargeAmount, "document.chargeAmount"),
    taxBaseAmount: safeNumber(taxBaseAmount, "document.taxBaseAmount"),
    taxAmount: safeNumber(taxAmount, "document.taxAmount"),
    grandTotal: safeNumber(grandTotal, "document.grandTotal"),
    lineCount: lines.length,
  });
}
