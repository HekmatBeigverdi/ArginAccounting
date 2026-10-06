import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./sales-domain-errors.ts";

export type SalesAdjustmentMode = "amount" | "percent";

export interface SalesDiscount {
  readonly discountId: string;
  readonly mode: SalesAdjustmentMode;
  readonly value: number;
  readonly reason: string | null;
}

export interface SalesCharge {
  readonly chargeId: string;
  readonly mode: SalesAdjustmentMode;
  readonly value: number;
  readonly reason: string | null;
}

export interface SalesTax {
  readonly taxId: string;
  readonly rateBasisPoints: number;
  readonly taxCode: string | null;
}

export interface CreateSalesAdjustmentInput {
  readonly id: string;
  readonly mode: SalesAdjustmentMode;
  readonly value: number;
  readonly reason?: string | null;
}

export interface CreateSalesTaxInput {
  readonly taxId: string;
  readonly rateBasisPoints: number;
  readonly taxCode?: string | null;
}

function fail(code: (typeof SALES_DOMAIN_ERROR_CODES)[keyof typeof SALES_DOMAIN_ERROR_CODES], field: string): never {
  throw new SalesDomainError(code, field);
}
function required(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail(SALES_DOMAIN_ERROR_CODES.identityRequired, field);
  return value.trim();
}
function optionalText(value: string | null | undefined, field: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, field);
  return value.trim() || null;
}
function adjustment(input: CreateSalesAdjustmentInput, field: string): Readonly<{ id: string; mode: SalesAdjustmentMode; value: number; reason: string | null }> {
  if (typeof input !== "object" || input === null) return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, field);
  if (input.mode !== "amount" && input.mode !== "percent") return fail(SALES_DOMAIN_ERROR_CODES.adjustmentModeInvalid, field + ".mode");
  if (!Number.isSafeInteger(input.value) || input.value < 0) return fail(SALES_DOMAIN_ERROR_CODES.adjustmentValueInvalid, field + ".value");
  if (input.mode === "percent" && input.value > 10000) return fail(SALES_DOMAIN_ERROR_CODES.adjustmentValueInvalid, field + ".value");
  return Object.freeze({ id: required(input.id, field + ".id"), mode: input.mode, value: input.value, reason: optionalText(input.reason, field + ".reason") });
}

export function createSalesDiscount(input: CreateSalesAdjustmentInput): SalesDiscount {
  const value = adjustment(input, "discount");
  return Object.freeze({ discountId: value.id, mode: value.mode, value: value.value, reason: value.reason });
}

export function createSalesCharge(input: CreateSalesAdjustmentInput): SalesCharge {
  const value = adjustment(input, "charge");
  return Object.freeze({ chargeId: value.id, mode: value.mode, value: value.value, reason: value.reason });
}

export function createSalesTax(input: CreateSalesTaxInput): SalesTax {
  if (typeof input !== "object" || input === null) return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "tax");
  if (!Number.isSafeInteger(input.rateBasisPoints) || input.rateBasisPoints < 0 || input.rateBasisPoints > 10000) {
    return fail(SALES_DOMAIN_ERROR_CODES.taxRateInvalid, "tax.rateBasisPoints");
  }
  return Object.freeze({
    taxId: required(input.taxId, "tax.taxId"),
    rateBasisPoints: input.rateBasisPoints,
    taxCode: optionalText(input.taxCode, "tax.taxCode"),
  });
}
