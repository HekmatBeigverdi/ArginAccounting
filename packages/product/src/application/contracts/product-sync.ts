import type { ProductKind, ProductStatus } from "../../domain/product.ts";
import type { ProductIdentifierProfile } from "../../domain/product-identifiers.ts";
import type { ProductMasterDataProfile } from "../../domain/product-master-data.ts";
import type { ProductUnitProfile } from "../../domain/product-unit.ts";

export const productSyncChangeKinds = ["upsert", "tombstone"] as const;
export type ProductSyncChangeKind = (typeof productSyncChangeKinds)[number];

export interface ProductExternalReference {
  readonly sourceSystem: string;
  readonly externalId: string;
}

export interface ProductSyncEntityReference {
  readonly companyId: string;
  readonly productId: string;
  readonly displayCode: string;
}

export interface ProductSyncSnapshot {
  readonly productId: string;
  readonly companyId: string;
  readonly code: string;
  readonly title: string;
  readonly kind: ProductKind;
  readonly status: ProductStatus;
  readonly categoryId: string | null;
  readonly purchasable: boolean;
  readonly sellable: boolean;
  readonly identifiers: Readonly<ProductIdentifierProfile>;
  readonly units: Readonly<ProductUnitProfile> | null;
  readonly masterData: Readonly<ProductMasterDataProfile>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface ProductSyncEnvelopeBase {
  readonly entity: "product";
  readonly operationId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly reference: ProductSyncEntityReference;
  readonly version: number;
  readonly changedAt: string;
  readonly externalReferences: readonly Readonly<ProductExternalReference>[];
}

export interface ProductSyncUpsertEnvelope extends ProductSyncEnvelopeBase {
  readonly changeKind: "upsert";
  readonly deletedAt: null;
  readonly snapshot: Readonly<ProductSyncSnapshot>;
}

export interface ProductSyncTombstoneEnvelope extends ProductSyncEnvelopeBase {
  readonly changeKind: "tombstone";
  readonly deletedAt: string;
  readonly snapshot: null;
}

export type ProductSyncChangeEnvelope =
  | ProductSyncUpsertEnvelope
  | ProductSyncTombstoneEnvelope;

export interface CreateProductSyncUpsertInput {
  readonly operationId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly reference: ProductSyncEntityReference;
  readonly version: number;
  readonly changedAt: string;
  readonly externalReferences?: readonly ProductExternalReference[];
  readonly snapshot: ProductSyncSnapshot;
}

export interface CreateProductSyncTombstoneInput {
  readonly operationId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly reference: ProductSyncEntityReference;
  readonly version: number;
  readonly changedAt: string;
  readonly deletedAt: string;
  readonly externalReferences?: readonly ProductExternalReference[];
}

export type ProductSyncContractErrorCode =
  | "product.sync.operation-id.required"
  | "product.sync.request-id.required"
  | "product.sync.idempotency-key.required"
  | "product.sync.reference.invalid"
  | "product.sync.version.invalid"
  | "product.sync.timestamp.invalid"
  | "product.sync.snapshot.mismatch"
  | "product.sync.external-reference.invalid"
  | "product.sync.external-reference.duplicate";

export class ProductSyncContractError extends Error {
  constructor(
    public readonly code: ProductSyncContractErrorCode,
    message = code,
  ) {
    super(message);
    this.name = "ProductSyncContractError";
  }
}

const requireText = (
  value: string,
  code: ProductSyncContractErrorCode,
): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new ProductSyncContractError(code);
  }
  return normalized;
};

const requireTimestamp = (value: string): string => {
  const normalized = value.trim();
  if (!normalized || Number.isNaN(Date.parse(normalized))) {
    throw new ProductSyncContractError("product.sync.timestamp.invalid");
  }
  return new Date(Date.parse(normalized)).toISOString();
};

const normalizeReference = (
  reference: ProductSyncEntityReference,
): Readonly<ProductSyncEntityReference> => {
  const companyId = reference.companyId.trim();
  const productId = reference.productId.trim();
  const displayCode = reference.displayCode.trim();
  if (!companyId || !productId || !displayCode) {
    throw new ProductSyncContractError("product.sync.reference.invalid");
  }
  return Object.freeze({ companyId, productId, displayCode });
};

const normalizeExternalReferences = (
  references: readonly ProductExternalReference[],
): readonly Readonly<ProductExternalReference>[] => {
  const normalized: Readonly<ProductExternalReference>[] = [];
  const seen = new Set<string>();
  for (const reference of references) {
    const sourceSystem = reference.sourceSystem.trim();
    const externalId = reference.externalId.trim();
    if (!sourceSystem || !externalId) {
      throw new ProductSyncContractError(
        "product.sync.external-reference.invalid",
      );
    }
    const key = `${sourceSystem}\u0000${externalId}`;
    if (seen.has(key)) {
      throw new ProductSyncContractError(
        "product.sync.external-reference.duplicate",
      );
    }
    seen.add(key);
    normalized.push(Object.freeze({ sourceSystem, externalId }));
  }
  return Object.freeze(normalized);
};

const normalizeBase = (input: {
  readonly operationId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly reference: ProductSyncEntityReference;
  readonly version: number;
  readonly changedAt: string;
  readonly externalReferences?: readonly ProductExternalReference[];
}) => {
  if (!Number.isSafeInteger(input.version) || input.version < 1) {
    throw new ProductSyncContractError("product.sync.version.invalid");
  }
  return Object.freeze({
    operationId: requireText(
      input.operationId,
      "product.sync.operation-id.required",
    ),
    requestId: requireText(input.requestId, "product.sync.request-id.required"),
    idempotencyKey: requireText(
      input.idempotencyKey,
      "product.sync.idempotency-key.required",
    ),
    reference: normalizeReference(input.reference),
    version: input.version,
    changedAt: requireTimestamp(input.changedAt),
    externalReferences: normalizeExternalReferences(
      input.externalReferences ?? [],
    ),
  });
};

export const createProductSyncUpsertEnvelope = (
  input: CreateProductSyncUpsertInput,
): Readonly<ProductSyncUpsertEnvelope> => {
  const base = normalizeBase(input);
  if (
    input.snapshot.productId !== base.reference.productId ||
    input.snapshot.companyId !== base.reference.companyId ||
    input.snapshot.code !== base.reference.displayCode
  ) {
    throw new ProductSyncContractError("product.sync.snapshot.mismatch");
  }
  return Object.freeze({
    ...base,
    entity: "product",
    changeKind: "upsert",
    deletedAt: null,
    snapshot: Object.freeze(input.snapshot),
  });
};

export const createProductSyncTombstoneEnvelope = (
  input: CreateProductSyncTombstoneInput,
): Readonly<ProductSyncTombstoneEnvelope> => {
  const base = normalizeBase(input);
  const deletedAt = requireTimestamp(input.deletedAt);
  if (Date.parse(deletedAt) > Date.parse(base.changedAt)) {
    throw new ProductSyncContractError("product.sync.timestamp.invalid");
  }
  return Object.freeze({
    ...base,
    entity: "product",
    changeKind: "tombstone",
    deletedAt,
    snapshot: null,
  });
};
