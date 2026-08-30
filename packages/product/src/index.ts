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

export type {
  CreateProductInput,
  ProductCapabilities,
  ProductDomainErrorCode,
  ProductKind,
  ProductSnapshot,
  ProductStatus,
} from "./domain/product.ts";
