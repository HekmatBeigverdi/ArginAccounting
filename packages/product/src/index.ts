export {
  PRODUCT_DOMAIN_ERROR_CODES,
  ProductDomainError,
  activateProduct,
  assignProductCategory,
  configureProductCapabilities,
  createProduct,
  deactivateProduct,
  rehydrateProduct,
} from "./domain/product.ts";

export {
  createProductIdentifierProfile,
  normalizeTaxpayerGoodsServiceId,
} from "./domain/product-identifiers.ts";

export {
  createProductMasterDataProfile,
} from "./domain/product-master-data.ts";

export {
  convertProductQuantity,
  createProductUnitProfile,
} from "./domain/product-unit.ts";

export {
  ProductService,
} from "./application/product-service.ts";

export {
  PRODUCT_APPLICATION_ERROR_CODES,
  ProductApplicationError,
} from "./application/contracts/product-errors.ts";

export {
  PRODUCT_QUERY_LIMITS,
} from "./application/contracts/product-queries.ts";

export {
  ProductSyncContractError,
  createProductSyncTombstoneEnvelope,
  createProductSyncUpsertEnvelope,
  productSyncChangeKinds,
} from "./application/contracts/product-sync.ts";

export {
  diffTaxpayerUnitReferenceDataset,
  normalizeTaxpayerUnitReferenceDataset,
} from "./reference/taxpayer-unit-reference.ts";

export type {
  CreateProductInput,
  ProductCapabilities,
  ProductDomainErrorCode,
  ProductKind,
  ProductSnapshot,
  ProductStatus,
} from "./domain/product.ts";

export type {
  CreateProductIdentifierProfileInput,
  ProductExternalIdentifier,
  ProductIdentifierProfile,
} from "./domain/product-identifiers.ts";

export type {
  CreateProductMasterDataProfileInput,
  ProductCommercialAttributes,
  ProductMasterDataProfile,
  ProductOperationalAttributes,
  ProductTaxAttributes,
  ProductTaxTreatment,
} from "./domain/product-master-data.ts";

export type {
  CreateProductUnitProfileInput,
  ProductUnitDefinition,
  ProductUnitProfile,
  QuantityRoundingMode,
} from "./domain/product-unit.ts";

export type {
  ProductServiceDependencies,
} from "./application/product-service.ts";

export type {
  CreateProductCommand,
  ProductRequestContext,
  ReplaceProductIdentifiersCommand,
  ReplaceProductMasterDataCommand,
  ReplaceProductUnitsCommand,
  SetProductStatusCommand,
  UpdateProductIdentityCommand,
} from "./application/contracts/product-commands.ts";

export type {
  ProductApplicationContract,
} from "./application/contracts/product-contracts.ts";

export type {
  ProductDto,
  ProductListItemDto,
  ProductPageDto,
  ProductSelectorItemDto,
} from "./application/contracts/product-dto.ts";

export type {
  ProductDuplicateCandidate,
  ProductDuplicateCheckResult,
  ProductDuplicateDetector,
  ProductDuplicateProbe,
  ProductDuplicateReason,
  ProductDuplicateStrength,
  ProductIdempotencyExecutor,
} from "./application/contracts/product-duplicates.ts";

export type {
  ProductApplicationErrorCode,
} from "./application/contracts/product-errors.ts";

export type {
  GetProductByCodeQuery,
  GetProductByIdQuery,
  ListProductsQuery,
  ProductFilter,
  ProductPageRequest,
  ProductSelectorQuery,
  ProductSort,
  ProductSortDirection,
  ProductSortField,
} from "./application/contracts/product-queries.ts";

export type {
  ProductReader,
} from "./application/contracts/product-reader.ts";

export type {
  TaxpayerUnitReferenceValidator,
} from "./application/contracts/product-reference-validation.ts";

export type {
  ProductPersistenceState,
  ProductRepository,
} from "./application/contracts/product-repository.ts";

export type {
  ProductUnitOfWork,
  ProductUnitOfWorkRepositories,
} from "./application/contracts/product-unit-of-work.ts";

export type {
  CreateProductSyncTombstoneInput,
  CreateProductSyncUpsertInput,
  ProductExternalReference,
  ProductSyncChangeEnvelope,
  ProductSyncChangeKind,
  ProductSyncContractErrorCode,
  ProductSyncEntityReference,
  ProductSyncSnapshot,
  ProductSyncTombstoneEnvelope,
  ProductSyncUpsertEnvelope,
} from "./application/contracts/product-sync.ts";

export type {
  TaxpayerUnitReferenceDataset,
  TaxpayerUnitReferenceDiff,
  TaxpayerUnitReferenceEntry,
} from "./reference/taxpayer-unit-reference.ts";
