import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./sales-domain-errors.ts";

export interface SalesPriceRevision {
  readonly priceRevisionId: string;
  readonly revision: number;
  readonly currency: string;
  readonly unitPrice: number;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
}

export interface CreateSalesPriceRevisionInput {
  readonly priceRevisionId: string;
  readonly revision: number;
  readonly currency: string;
  readonly unitPrice: number;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string | null;
}

function fail(
  code: (typeof SALES_DOMAIN_ERROR_CODES)[keyof typeof SALES_DOMAIN_ERROR_CODES],
  field: string,
): never {
  throw new SalesDomainError(code, field);
}

function requireTrimmedString(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    return fail(SALES_DOMAIN_ERROR_CODES.identityRequired, field);
  }
  return value.trim();
}

function normalizeDate(value: string, field: string): string {
  const normalizedDate = requireTrimmedString(value, field);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate) ||
    Number.isNaN(Date.parse(`${normalizedDate}T00:00:00Z`))
  ) {
    return fail(SALES_DOMAIN_ERROR_CODES.priceEffectiveDateInvalid, field);
  }
  return normalizedDate;
}

function normalizeCurrency(value: string): string {
  const normalizedCurrency = requireTrimmedString(value, "priceRevision.currency").toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    return fail(SALES_DOMAIN_ERROR_CODES.priceCurrencyInvalid, "priceRevision.currency");
  }
  return normalizedCurrency;
}

export function createSalesPriceRevision(input: CreateSalesPriceRevisionInput): SalesPriceRevision {
  if (typeof input !== "object" || input === null) {
    return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "priceRevision");
  }
  if (!Number.isInteger(input.revision) || input.revision < 1) {
    return fail(SALES_DOMAIN_ERROR_CODES.priceRevisionInvalid, "priceRevision.revision");
  }
  if (!Number.isSafeInteger(input.unitPrice) || input.unitPrice < 0) {
    return fail(SALES_DOMAIN_ERROR_CODES.priceInvalid, "priceRevision.unitPrice");
  }

  const effectiveFrom = normalizeDate(input.effectiveFrom, "priceRevision.effectiveFrom");
  const effectiveTo = input.effectiveTo == null
    ? null
    : normalizeDate(input.effectiveTo, "priceRevision.effectiveTo");

  if (effectiveTo !== null && effectiveTo < effectiveFrom) {
    return fail(SALES_DOMAIN_ERROR_CODES.priceEffectiveDateInvalid, "priceRevision.effectiveTo");
  }

  return Object.freeze({
    priceRevisionId: requireTrimmedString(input.priceRevisionId, "priceRevision.priceRevisionId"),
    revision: input.revision,
    currency: normalizeCurrency(input.currency),
    unitPrice: input.unitPrice,
    effectiveFrom,
    effectiveTo,
  });
}

export function isSalesPriceRevisionEffective(
  revision: SalesPriceRevision,
  businessDate: string,
  requestedCurrency: string,
): boolean {
  const normalizedBusinessDate = normalizeDate(businessDate, "resolution.businessDate");
  const normalizedCurrency = normalizeCurrency(requestedCurrency);

  // Both date boundaries are inclusive; a null end date keeps the revision open-ended.
  return (
    revision.currency === normalizedCurrency &&
    revision.effectiveFrom <= normalizedBusinessDate &&
    (revision.effectiveTo === null || normalizedBusinessDate <= revision.effectiveTo)
  );
}
