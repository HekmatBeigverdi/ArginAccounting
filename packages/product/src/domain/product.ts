export type ProductKind = "product" | "service";
export type ProductStatus = "active" | "inactive";

export const PRODUCT_DOMAIN_ERROR_CODES = {
  idRequired: "product.id.required",
  companyIdRequired: "product.company-id.required",
  codeRequired: "product.code.required",
  titleRequired: "product.title.required",
  kindInvalid: "product.kind.invalid",
  createdAtInvalid: "product.created-at.invalid",
  updatedAtInvalid: "product.updated-at.invalid",
  timestampOrderInvalid: "product.timestamp-order.invalid",
} as const;

export type ProductDomainErrorCode =
  (typeof PRODUCT_DOMAIN_ERROR_CODES)[keyof typeof PRODUCT_DOMAIN_ERROR_CODES];

export class ProductDomainError extends Error {
  constructor(public readonly code: ProductDomainErrorCode) {
    super(code);
    this.name = "ProductDomainError";
  }
}

export interface ProductSnapshot {
  readonly productId: string;
  readonly companyId: string;
  readonly code: string;
  readonly title: string;
  readonly kind: ProductKind;
  readonly status: ProductStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateProductInput {
  readonly productId: string;
  readonly companyId: string;
  readonly code: string;
  readonly title: string;
  readonly kind: ProductKind;
  readonly createdAt: string;
}

const normalizeRequired = (
  value: string,
  errorCode: ProductDomainErrorCode,
): string => {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (normalized.length === 0) {
    throw new ProductDomainError(errorCode);
  }
  return normalized;
};

const normalizeCode = (value: string): string =>
  normalizeRequired(value, PRODUCT_DOMAIN_ERROR_CODES.codeRequired).toUpperCase();

const normalizeTimestamp = (
  value: string,
  errorCode: ProductDomainErrorCode,
): string => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new ProductDomainError(errorCode);
  }
  return new Date(timestamp).toISOString();
};

const assertKind = (kind: string): asserts kind is ProductKind => {
  if (kind !== "product" && kind !== "service") {
    throw new ProductDomainError(PRODUCT_DOMAIN_ERROR_CODES.kindInvalid);
  }
};

const freezeSnapshot = (snapshot: ProductSnapshot): ProductSnapshot =>
  Object.freeze({ ...snapshot });

export const createProduct = (input: CreateProductInput): ProductSnapshot => {
  assertKind(input.kind);
  const createdAt = normalizeTimestamp(
    input.createdAt,
    PRODUCT_DOMAIN_ERROR_CODES.createdAtInvalid,
  );

  return freezeSnapshot({
    productId: normalizeRequired(
      input.productId,
      PRODUCT_DOMAIN_ERROR_CODES.idRequired,
    ),
    companyId: normalizeRequired(
      input.companyId,
      PRODUCT_DOMAIN_ERROR_CODES.companyIdRequired,
    ),
    code: normalizeCode(input.code),
    title: normalizeRequired(input.title, PRODUCT_DOMAIN_ERROR_CODES.titleRequired),
    kind: input.kind,
    status: "active",
    createdAt,
    updatedAt: createdAt,
  });
};

export const rehydrateProduct = (snapshot: ProductSnapshot): ProductSnapshot => {
  assertKind(snapshot.kind);
  const createdAt = normalizeTimestamp(
    snapshot.createdAt,
    PRODUCT_DOMAIN_ERROR_CODES.createdAtInvalid,
  );
  const updatedAt = normalizeTimestamp(
    snapshot.updatedAt,
    PRODUCT_DOMAIN_ERROR_CODES.updatedAtInvalid,
  );

  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new ProductDomainError(PRODUCT_DOMAIN_ERROR_CODES.timestampOrderInvalid);
  }

  if (snapshot.status !== "active" && snapshot.status !== "inactive") {
    throw new ProductDomainError(PRODUCT_DOMAIN_ERROR_CODES.kindInvalid);
  }

  return freezeSnapshot({
    productId: normalizeRequired(
      snapshot.productId,
      PRODUCT_DOMAIN_ERROR_CODES.idRequired,
    ),
    companyId: normalizeRequired(
      snapshot.companyId,
      PRODUCT_DOMAIN_ERROR_CODES.companyIdRequired,
    ),
    code: normalizeCode(snapshot.code),
    title: normalizeRequired(snapshot.title, PRODUCT_DOMAIN_ERROR_CODES.titleRequired),
    kind: snapshot.kind,
    status: snapshot.status,
    createdAt,
    updatedAt,
  });
};
