import {
  PRODUCT_DOMAIN_ERROR_CODES,
  ProductDomainError,
  type ProductKind,
} from "./product.ts";

export type ProductTaxTreatment =
  | "unspecified"
  | "taxable"
  | "exempt"
  | "not-subject";

export interface ProductCommercialAttributes {
  readonly brand: string | null;
  readonly model: string | null;
  readonly purchaseDescription: string | null;
  readonly salesDescription: string | null;
  readonly defaultPurchaseUnitId: string | null;
  readonly defaultSalesUnitId: string | null;
}

export interface ProductTaxAttributes {
  readonly treatment: ProductTaxTreatment;
  readonly vatRateBasisPoints: number | null;
}

export interface ProductOperationalAttributes {
  readonly stockTracking: boolean;
  readonly serialTracking: boolean;
  readonly lotTracking: boolean;
  readonly shelfLifeDays: number | null;
}

export interface ProductMasterDataProfile {
  readonly commercial: Readonly<ProductCommercialAttributes>;
  readonly tax: Readonly<ProductTaxAttributes>;
  readonly operational: Readonly<ProductOperationalAttributes>;
}

export interface CreateProductMasterDataProfileInput {
  readonly kind: ProductKind;
  readonly commercial?: Partial<ProductCommercialAttributes>;
  readonly tax?: Partial<ProductTaxAttributes>;
  readonly operational?: Partial<ProductOperationalAttributes>;
}

const normalizeOptionalText = (
  value: string | null | undefined,
  errorCode = PRODUCT_DOMAIN_ERROR_CODES.commercialAttributeInvalid,
): string | null => {
  if (value == null) {
    return null;
  }
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (normalized.length === 0) {
    throw new ProductDomainError(errorCode);
  }
  return normalized;
};

const normalizeTax = (
  input: Partial<ProductTaxAttributes> | undefined,
): Readonly<ProductTaxAttributes> => {
  const treatment = input?.treatment ?? "unspecified";
  if (
    treatment !== "unspecified" &&
    treatment !== "taxable" &&
    treatment !== "exempt" &&
    treatment !== "not-subject"
  ) {
    throw new ProductDomainError(PRODUCT_DOMAIN_ERROR_CODES.taxTreatmentInvalid);
  }

  const rate = input?.vatRateBasisPoints ?? null;
  if (treatment === "taxable") {
    if (!Number.isInteger(rate) || rate < 0 || rate > 10_000) {
      throw new ProductDomainError(PRODUCT_DOMAIN_ERROR_CODES.vatRateInvalid);
    }
  } else if (rate !== null) {
    throw new ProductDomainError(PRODUCT_DOMAIN_ERROR_CODES.vatRateInvalid);
  }

  return Object.freeze({ treatment, vatRateBasisPoints: rate });
};

const normalizeOperational = (
  kind: ProductKind,
  input: Partial<ProductOperationalAttributes> | undefined,
): Readonly<ProductOperationalAttributes> => {
  const stockTracking = input?.stockTracking ?? false;
  const serialTracking = input?.serialTracking ?? false;
  const lotTracking = input?.lotTracking ?? false;
  const shelfLifeDays = input?.shelfLifeDays ?? null;

  if (
    typeof stockTracking !== "boolean" ||
    typeof serialTracking !== "boolean" ||
    typeof lotTracking !== "boolean"
  ) {
    throw new ProductDomainError(
      PRODUCT_DOMAIN_ERROR_CODES.operationalAttributeInvalid,
    );
  }

  if (kind === "service" && (stockTracking || serialTracking || lotTracking || shelfLifeDays !== null)) {
    throw new ProductDomainError(
      PRODUCT_DOMAIN_ERROR_CODES.serviceStockTrackingInvalid,
    );
  }

  if ((serialTracking || lotTracking) && !stockTracking) {
    throw new ProductDomainError(
      PRODUCT_DOMAIN_ERROR_CODES.operationalAttributeInvalid,
    );
  }

  if (shelfLifeDays !== null) {
    if (!Number.isInteger(shelfLifeDays) || shelfLifeDays <= 0 || !stockTracking) {
      throw new ProductDomainError(
        PRODUCT_DOMAIN_ERROR_CODES.operationalAttributeInvalid,
      );
    }
  }

  return Object.freeze({
    stockTracking,
    serialTracking,
    lotTracking,
    shelfLifeDays,
  });
};

export const createProductMasterDataProfile = (
  input: CreateProductMasterDataProfileInput,
): Readonly<ProductMasterDataProfile> => {
  const commercial = Object.freeze({
    brand: normalizeOptionalText(input.commercial?.brand),
    model: normalizeOptionalText(input.commercial?.model),
    purchaseDescription: normalizeOptionalText(
      input.commercial?.purchaseDescription,
    ),
    salesDescription: normalizeOptionalText(input.commercial?.salesDescription),
    defaultPurchaseUnitId: normalizeOptionalText(
      input.commercial?.defaultPurchaseUnitId,
    ),
    defaultSalesUnitId: normalizeOptionalText(
      input.commercial?.defaultSalesUnitId,
    ),
  });

  return Object.freeze({
    commercial,
    tax: normalizeTax(input.tax),
    operational: normalizeOperational(input.kind, input.operational),
  });
};
