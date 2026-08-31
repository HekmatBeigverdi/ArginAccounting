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
  TaxpayerUnitReferenceDataset,
  TaxpayerUnitReferenceDiff,
  TaxpayerUnitReferenceEntry,
} from "./reference/taxpayer-unit-reference.ts";
