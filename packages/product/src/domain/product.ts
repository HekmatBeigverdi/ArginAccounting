export type ProductKind = "product" | "service";
export type ProductStatus = "active" | "inactive";

export interface ProductCapabilities {
  readonly purchasable: boolean;
  readonly sellable: boolean;
}

export const PRODUCT_DOMAIN_ERROR_CODES = {
  idRequired: "product.id.required",
  companyIdRequired: "product.company-id.required",
  codeRequired: "product.code.required",
  titleRequired: "product.title.required",
  kindInvalid: "product.kind.invalid",
  statusInvalid: "product.status.invalid",
  categoryIdInvalid: "product.category-id.invalid",
  capabilityInvalid: "product.capability.invalid",
  unitInvalid: "product.unit.invalid",
  unitRatioInvalid: "product.unit.ratio.invalid",
  baseUnitRatioInvalid: "product.unit.base-ratio.invalid",
  unitPrecisionInvalid: "product.unit.precision.invalid",
  unitRoundingInvalid: "product.unit.rounding.invalid",
  unitDuplicate: "product.unit.duplicate",
  unitNotFound: "product.unit.not-found",
  taxpayerUnitCodeInvalid: "product.unit.taxpayer-code.invalid",
  quantityInvalid: "product.quantity.invalid",
  barcodeInvalid: "product.barcode.invalid",
  barcodeDuplicate: "product.barcode.duplicate",
  taxpayerGoodsServiceIdInvalid: "product.taxpayer-goods-service-id.invalid",
  externalIdentifierInvalid: "product.external-identifier.invalid",
  externalIdentifierDuplicate: "product.external-identifier.duplicate",
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
  readonly categoryId: string | null;
  readonly capabilities: Readonly<ProductCapabilities>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateProductInput {
  readonly productId: string;
  readonly companyId: string;
  readonly code: string;
  readonly title: string;
  readonly kind: ProductKind;
  readonly categoryId?: string | null;
  readonly capabilities?: ProductCapabilities;
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

const normalizeCategoryId = (value: string | null | undefined): string | null => {
  if (value == null) {
    return null;
  }
  return normalizeRequired(value, PRODUCT_DOMAIN_ERROR_CODES.categoryIdInvalid);
};

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

function assertKind(kind: string): asserts kind is ProductKind {
  if (kind !== "product" && kind !== "service") {
    throw new ProductDomainError(PRODUCT_DOMAIN_ERROR_CODES.kindInvalid);
  }
}

function assertStatus(status: string): asserts status is ProductStatus {
  if (status !== "active" && status !== "inactive") {
    throw new ProductDomainError(PRODUCT_DOMAIN_ERROR_CODES.statusInvalid);
  }
}

const normalizeCapabilities = (
  capabilities: ProductCapabilities | undefined,
): Readonly<ProductCapabilities> => {
  const resolved = capabilities ?? { purchasable: true, sellable: true };
  if (
    typeof resolved.purchasable !== "boolean" ||
    typeof resolved.sellable !== "boolean"
  ) {
    throw new ProductDomainError(PRODUCT_DOMAIN_ERROR_CODES.capabilityInvalid);
  }
  return Object.freeze({ ...resolved });
};

const freezeSnapshot = (snapshot: ProductSnapshot): ProductSnapshot =>
  Object.freeze({
    ...snapshot,
    capabilities: Object.freeze({ ...snapshot.capabilities }),
  });

const assertMutationTimestamp = (current: ProductSnapshot, at: string): string => {
  const normalized = normalizeTimestamp(
    at,
    PRODUCT_DOMAIN_ERROR_CODES.updatedAtInvalid,
  );
  if (Date.parse(normalized) < Date.parse(current.updatedAt)) {
    throw new ProductDomainError(PRODUCT_DOMAIN_ERROR_CODES.timestampOrderInvalid);
  }
  return normalized;
};

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
    categoryId: normalizeCategoryId(input.categoryId),
    capabilities: normalizeCapabilities(input.capabilities),
    createdAt,
    updatedAt: createdAt,
  });
};

export const rehydrateProduct = (snapshot: ProductSnapshot): ProductSnapshot => {
  assertKind(snapshot.kind);
  assertStatus(snapshot.status);
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
    categoryId: normalizeCategoryId(snapshot.categoryId),
    capabilities: normalizeCapabilities(snapshot.capabilities),
    createdAt,
    updatedAt,
  });
};

export const activateProduct = (
  snapshot: ProductSnapshot,
  at: string,
): ProductSnapshot => {
  if (snapshot.status === "active") {
    return snapshot;
  }
  return freezeSnapshot({
    ...snapshot,
    status: "active",
    updatedAt: assertMutationTimestamp(snapshot, at),
  });
};

export const deactivateProduct = (
  snapshot: ProductSnapshot,
  at: string,
): ProductSnapshot => {
  if (snapshot.status === "inactive") {
    return snapshot;
  }
  return freezeSnapshot({
    ...snapshot,
    status: "inactive",
    updatedAt: assertMutationTimestamp(snapshot, at),
  });
};

export const assignProductCategory = (
  snapshot: ProductSnapshot,
  categoryId: string | null,
  at: string,
): ProductSnapshot => {
  const normalizedCategoryId = normalizeCategoryId(categoryId);
  if (snapshot.categoryId === normalizedCategoryId) {
    return snapshot;
  }
  return freezeSnapshot({
    ...snapshot,
    categoryId: normalizedCategoryId,
    updatedAt: assertMutationTimestamp(snapshot, at),
  });
};

export const configureProductCapabilities = (
  snapshot: ProductSnapshot,
  capabilities: ProductCapabilities,
  at: string,
): ProductSnapshot => {
  const normalized = normalizeCapabilities(capabilities);
  if (
    snapshot.capabilities.purchasable === normalized.purchasable &&
    snapshot.capabilities.sellable === normalized.sellable
  ) {
    return snapshot;
  }
  return freezeSnapshot({
    ...snapshot,
    capabilities: normalized,
    updatedAt: assertMutationTimestamp(snapshot, at),
  });
};
