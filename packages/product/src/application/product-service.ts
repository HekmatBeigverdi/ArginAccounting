import {
  activateProduct,
  createProduct,
  deactivateProduct,
  rehydrateProduct,
  type ProductSnapshot,
} from "../domain/product.ts";
import { createProductIdentifierProfile } from "../domain/product-identifiers.ts";
import {
  createProductMasterDataProfile,
  type ProductMasterDataProfile,
} from "../domain/product-master-data.ts";
import { createProductUnitProfile } from "../domain/product-unit.ts";
import type {
  CreateProductCommand,
  ProductRequestContext,
  ReplaceProductIdentifiersCommand,
  ReplaceProductMasterDataCommand,
  ReplaceProductUnitsCommand,
  SetProductStatusCommand,
  UpdateProductIdentityCommand,
} from "./contracts/product-commands.ts";
import type { ProductApplicationContract } from "./contracts/product-contracts.ts";
import type {
  ProductDto,
  ProductListItemDto,
  ProductPageDto,
  ProductSelectorItemDto,
} from "./contracts/product-dto.ts";
import {
  PRODUCT_APPLICATION_ERROR_CODES,
  ProductApplicationError,
} from "./contracts/product-errors.ts";
import type {
  ProductDuplicateCheckResult,
  ProductDuplicateDetector,
  ProductDuplicateProbe,
  ProductIdempotencyExecutor,
} from "./contracts/product-duplicates.ts";
import type {
  GetProductByCodeQuery,
  GetProductByIdQuery,
  ListProductsQuery,
  ProductSelectorQuery,
} from "./contracts/product-queries.ts";
import type { ProductReader } from "./contracts/product-reader.ts";
import type {
  ProductPersistenceState,
  ProductRepository,
} from "./contracts/product-repository.ts";
import type { ProductUnitOfWork } from "./contracts/product-unit-of-work.ts";

const requireText = (value: string): string => {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new ProductApplicationError(
      PRODUCT_APPLICATION_ERROR_CODES.invalidRequest,
    );
  }
  return normalized;
};

const normalizeContext = (context: ProductRequestContext): ProductRequestContext => {
  const timestamp = Date.parse(context.occurredAt);
  if (!Number.isFinite(timestamp)) {
    throw new ProductApplicationError(
      PRODUCT_APPLICATION_ERROR_CODES.invalidRequest,
    );
  }
  return Object.freeze({
    requestId: requireText(context.requestId),
    actorId: requireText(context.actorId),
    companyId: requireText(context.companyId),
    occurredAt: new Date(timestamp).toISOString(),
  });
};

const assertExpectedVersion = (value: number): number => {
  if (!Number.isInteger(value) || value < 1) {
    throw new ProductApplicationError(
      PRODUCT_APPLICATION_ERROR_CODES.invalidRequest,
    );
  }
  return value;
};

const toDto = (state: ProductPersistenceState): ProductDto => Object.freeze({
  productId: state.product.productId,
  companyId: state.product.companyId,
  code: state.product.code,
  title: state.product.title,
  kind: state.product.kind,
  status: state.product.status,
  categoryId: state.product.categoryId,
  capabilities: state.product.capabilities,
  identifiers: state.identifiers,
  units: state.units,
  masterData: state.masterData,
  version: state.version,
  createdAt: state.product.createdAt,
  updatedAt: state.product.updatedAt,
});

const nextState = (
  current: ProductPersistenceState,
  changes: Partial<Pick<ProductPersistenceState, "product" | "identifiers" | "units" | "masterData">>,
): ProductPersistenceState => Object.freeze({
  ...current,
  ...changes,
  version: current.version + 1,
});

const loadRequired = async (
  repository: ProductRepository,
  companyId: string,
  productId: string,
): Promise<ProductPersistenceState> => {
  const state = await repository.findById(companyId, requireText(productId));
  if (!state || state.product.companyId !== companyId) {
    throw new ProductApplicationError(PRODUCT_APPLICATION_ERROR_CODES.notFound);
  }
  return state;
};

const splitDuplicates = async (
  detector: ProductDuplicateDetector,
  probe: ProductDuplicateProbe,
): Promise<ProductDuplicateCheckResult> => {
  const candidates = await detector.detect(probe);
  return Object.freeze({
    hardConflicts: Object.freeze(
      candidates.filter((candidate) => candidate.strength === "hard"),
    ),
    advisoryCandidates: Object.freeze(
      candidates.filter((candidate) => candidate.strength === "advisory"),
    ),
  });
};

const assertNoHardIdentifierConflict = (
  result: ProductDuplicateCheckResult,
): void => {
  if (result.hardConflicts.some((candidate) => candidate.reason !== "code")) {
    throw new ProductApplicationError(
      PRODUCT_APPLICATION_ERROR_CODES.duplicateIdentifier,
    );
  }
};

export interface ProductServiceDependencies {
  readonly unitOfWork: ProductUnitOfWork;
  readonly reader: ProductReader;
  readonly duplicateDetector: ProductDuplicateDetector;
  readonly idempotency: ProductIdempotencyExecutor;
}

export class ProductService implements ProductApplicationContract {
  constructor(private readonly dependencies: ProductServiceDependencies) {}

  async checkDuplicates(
    probe: ProductDuplicateProbe,
  ): Promise<ProductDuplicateCheckResult> {
    return splitDuplicates(this.dependencies.duplicateDetector, probe);
  }

  async create(command: CreateProductCommand): Promise<ProductDto> {
    const context = normalizeContext(command.context);
    return this.dependencies.idempotency.run(
      `product:create:${context.companyId}`,
      context.requestId,
      async () => this.dependencies.unitOfWork.run(async ({ products }) => {
        const existingId = await products.findById(context.companyId, command.productId);
        if (existingId) {
          throw new ProductApplicationError(
            PRODUCT_APPLICATION_ERROR_CODES.duplicateIdentifier,
          );
        }

        const product = createProduct({
          productId: command.productId,
          companyId: context.companyId,
          code: command.code,
          title: command.title,
          kind: command.kind,
          ...(command.categoryId === undefined
            ? {}
            : { categoryId: command.categoryId }),
          ...(command.capabilities === undefined
            ? {}
            : { capabilities: command.capabilities }),
          createdAt: context.occurredAt,
        });
        const identifiers = createProductIdentifierProfile(command.identifiers);
        const units = command.units == null
          ? null
          : createProductUnitProfile(command.units);
        const masterData = createProductMasterDataProfile({
          kind: product.kind,
          ...(command.masterData ?? {}),
        });

        const codeConflict = await products.findByCode(
          context.companyId,
          product.code,
        );
        if (codeConflict) {
          throw new ProductApplicationError(
            PRODUCT_APPLICATION_ERROR_CODES.codeConflict,
          );
        }

        const duplicateResult = await this.checkDuplicates({
          companyId: context.companyId,
          code: product.code,
          title: product.title,
          identifiers,
          brand: masterData.commercial.brand,
          model: masterData.commercial.model,
        });
        if (duplicateResult.hardConflicts.some((candidate) => candidate.reason === "code")) {
          throw new ProductApplicationError(
            PRODUCT_APPLICATION_ERROR_CODES.codeConflict,
          );
        }
        assertNoHardIdentifierConflict(duplicateResult);

        const state: ProductPersistenceState = Object.freeze({
          product,
          identifiers,
          units,
          masterData,
          version: 1,
        });
        await products.add(state);
        return toDto(state);
      }),
    );
  }

  async updateIdentity(command: UpdateProductIdentityCommand): Promise<ProductDto> {
    return this.mutate(
      "identity",
      command.context,
      command.productId,
      command.expectedVersion,
      async (current, products, context) => {
        const updatedProduct: ProductSnapshot = rehydrateProduct({
          ...current.product,
          code: command.code,
          title: command.title,
          categoryId: command.categoryId,
          capabilities: command.capabilities,
          updatedAt: context.occurredAt,
        });
        if (updatedProduct.code !== current.product.code) {
          const conflict = await products.findByCode(
            context.companyId,
            updatedProduct.code,
          );
          if (conflict && conflict.product.productId !== current.product.productId) {
            throw new ProductApplicationError(
              PRODUCT_APPLICATION_ERROR_CODES.codeConflict,
            );
          }
        }
        const duplicates = await this.checkDuplicates({
          companyId: context.companyId,
          excludeProductId: current.product.productId,
          code: updatedProduct.code,
          title: updatedProduct.title,
          identifiers: current.identifiers,
          brand: current.masterData.commercial.brand,
          model: current.masterData.commercial.model,
        });
        if (duplicates.hardConflicts.some((candidate) => candidate.reason === "code")) {
          throw new ProductApplicationError(
            PRODUCT_APPLICATION_ERROR_CODES.codeConflict,
          );
        }
        return nextState(current, { product: updatedProduct });
      },
    );
  }

  async replaceIdentifiers(
    command: ReplaceProductIdentifiersCommand,
  ): Promise<ProductDto> {
    return this.mutate(
      "identifiers",
      command.context,
      command.productId,
      command.expectedVersion,
      async (current, _products, context) => {
        const identifiers = createProductIdentifierProfile(command.identifiers);
        const duplicates = await this.checkDuplicates({
          companyId: context.companyId,
          excludeProductId: current.product.productId,
          code: current.product.code,
          title: current.product.title,
          identifiers,
          brand: current.masterData.commercial.brand,
          model: current.masterData.commercial.model,
        });
        assertNoHardIdentifierConflict(duplicates);
        return nextState(current, { identifiers });
      },
    );
  }

  async replaceUnits(command: ReplaceProductUnitsCommand): Promise<ProductDto> {
    return this.mutate(
      "units",
      command.context,
      command.productId,
      command.expectedVersion,
      async (current) => nextState(current, {
        units: command.units == null ? null : createProductUnitProfile(command.units),
      }),
    );
  }

  async replaceMasterData(
    command: ReplaceProductMasterDataCommand,
  ): Promise<ProductDto> {
    return this.mutate(
      "master-data",
      command.context,
      command.productId,
      command.expectedVersion,
      async (current, _products, context) => {
        const masterData: Readonly<ProductMasterDataProfile> =
          createProductMasterDataProfile({
            kind: current.product.kind,
            ...command.masterData,
          });
        const duplicates = await this.checkDuplicates({
          companyId: context.companyId,
          excludeProductId: current.product.productId,
          code: current.product.code,
          title: current.product.title,
          identifiers: current.identifiers,
          brand: masterData.commercial.brand,
          model: masterData.commercial.model,
        });
        assertNoHardIdentifierConflict(duplicates);
        return nextState(current, { masterData });
      },
    );
  }

  async setStatus(command: SetProductStatusCommand): Promise<ProductDto> {
    return this.mutate(
      "status",
      command.context,
      command.productId,
      command.expectedVersion,
      async (current, _products, context) => {
        const product = command.active
          ? activateProduct(current.product, context.occurredAt)
          : deactivateProduct(current.product, context.occurredAt);
        if (product === current.product) {
          return current;
        }
        return nextState(current, { product });
      },
    );
  }

  getById(query: GetProductByIdQuery): Promise<ProductDto | null> {
    return this.dependencies.reader.getById(query);
  }

  getByCode(query: GetProductByCodeQuery): Promise<ProductDto | null> {
    return this.dependencies.reader.getByCode(query);
  }

  list(query: ListProductsQuery): Promise<ProductPageDto<ProductListItemDto>> {
    return this.dependencies.reader.list(query);
  }

  select(query: ProductSelectorQuery): Promise<readonly ProductSelectorItemDto[]> {
    return this.dependencies.reader.select(query);
  }

  private async mutate(
    scope: string,
    rawContext: ProductRequestContext,
    productId: string,
    rawExpectedVersion: number,
    transform: (
      current: ProductPersistenceState,
      repository: ProductRepository,
      context: ProductRequestContext,
    ) => Promise<ProductPersistenceState>,
  ): Promise<ProductDto> {
    const context = normalizeContext(rawContext);
    const expectedVersion = assertExpectedVersion(rawExpectedVersion);
    return this.dependencies.idempotency.run(
      `product:${scope}:${context.companyId}:${requireText(productId)}`,
      context.requestId,
      async () => this.dependencies.unitOfWork.run(async ({ products }) => {
        const current = await loadRequired(products, context.companyId, productId);
        if (current.version !== expectedVersion) {
          throw new ProductApplicationError(
            PRODUCT_APPLICATION_ERROR_CODES.concurrencyConflict,
          );
        }
        const updated = await transform(current, products, context);
        if (updated === current) {
          return toDto(current);
        }
        await products.update(updated, expectedVersion);
        return toDto(updated);
      }),
    );
  }
}
