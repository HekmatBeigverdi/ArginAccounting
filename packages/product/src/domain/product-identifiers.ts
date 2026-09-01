import {
  PRODUCT_DOMAIN_ERROR_CODES,
  ProductDomainError,
} from "./product.ts";

export interface ProductExternalIdentifier {
  readonly scheme: string;
  readonly value: string;
}

export interface ProductIdentifierProfile {
  readonly sku: string | null;
  readonly referenceCode: string | null;
  readonly barcodes: readonly string[];
  readonly taxpayerGoodsServiceId: string | null;
  readonly externalIdentifiers: readonly Readonly<ProductExternalIdentifier>[];
}

export interface CreateProductIdentifierProfileInput {
  readonly sku?: string | null;
  readonly referenceCode?: string | null;
  readonly barcodes?: readonly string[];
  readonly taxpayerGoodsServiceId?: string | null;
  readonly externalIdentifiers?: readonly ProductExternalIdentifier[];
}

const normalizeOptionalCode = (value: string | null | undefined): string | null => {
  if (value == null) {
    return null;
  }
  const normalized = value.trim().replace(/\s+/gu, " ").toUpperCase();
  return normalized.length === 0 ? null : normalized;
};

const normalizeBarcode = (value: string): string => {
  const normalized = value.trim().replace(/\s+/gu, "");
  if (normalized.length === 0) {
    throw new ProductDomainError(PRODUCT_DOMAIN_ERROR_CODES.barcodeInvalid);
  }
  return normalized;
};

export const normalizeTaxpayerGoodsServiceId = (
  value: string | null | undefined,
): string | null => {
  if (value == null || value.trim().length === 0) {
    return null;
  }
  const normalized = value.trim();
  if (!/^\d{13}$/u.test(normalized)) {
    throw new ProductDomainError(
      PRODUCT_DOMAIN_ERROR_CODES.taxpayerGoodsServiceIdInvalid,
    );
  }
  return normalized;
};

const normalizeExternalIdentifier = (
  identifier: ProductExternalIdentifier,
): Readonly<ProductExternalIdentifier> => {
  const scheme = identifier.scheme.trim().toUpperCase();
  const value = identifier.value.trim();
  if (scheme.length === 0 || value.length === 0) {
    throw new ProductDomainError(PRODUCT_DOMAIN_ERROR_CODES.externalIdentifierInvalid);
  }
  return Object.freeze({ scheme, value });
};

export const createProductIdentifierProfile = (
  input: CreateProductIdentifierProfileInput = {},
): Readonly<ProductIdentifierProfile> => {
  const barcodes = (input.barcodes ?? []).map(normalizeBarcode);
  if (new Set(barcodes).size !== barcodes.length) {
    throw new ProductDomainError(PRODUCT_DOMAIN_ERROR_CODES.barcodeDuplicate);
  }

  const externalIdentifiers = (input.externalIdentifiers ?? []).map(
    normalizeExternalIdentifier,
  );
  const externalKeys = externalIdentifiers.map(
    (identifier) => `${identifier.scheme}\u0000${identifier.value}`,
  );
  if (new Set(externalKeys).size !== externalKeys.length) {
    throw new ProductDomainError(
      PRODUCT_DOMAIN_ERROR_CODES.externalIdentifierDuplicate,
    );
  }

  return Object.freeze({
    sku: normalizeOptionalCode(input.sku),
    referenceCode: normalizeOptionalCode(input.referenceCode),
    barcodes: Object.freeze(barcodes),
    taxpayerGoodsServiceId: normalizeTaxpayerGoodsServiceId(
      input.taxpayerGoodsServiceId,
    ),
    externalIdentifiers: Object.freeze(externalIdentifiers),
  });
};
