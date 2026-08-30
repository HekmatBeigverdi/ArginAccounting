export {
  PRODUCT_DOMAIN_ERROR_CODES,
  ProductDomainError,
  createProduct,
  rehydrateProduct,
} from "./domain/product.ts";

export type {
  CreateProductInput,
  ProductDomainErrorCode,
  ProductKind,
  ProductSnapshot,
  ProductStatus,
} from "./domain/product.ts";
