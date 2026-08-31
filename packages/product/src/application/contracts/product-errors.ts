export const PRODUCT_APPLICATION_ERROR_CODES = Object.freeze({
  invalidRequest: "product.application.invalid-request",
  invalidPage: "product.application.invalid-page",
  invalidPageSize: "product.application.invalid-page-size",
  invalidSelectorLimit: "product.application.invalid-selector-limit",
  notFound: "product.application.not-found",
  codeConflict: "product.application.code-conflict",
  concurrencyConflict: "product.application.concurrency-conflict",
  duplicateIdentifier: "product.application.duplicate-identifier",
  unitReferenceInvalid: "product.application.unit-reference-invalid",
  taxpayerUnitReferenceInvalid: "product.application.taxpayer-unit-reference-invalid",
  unauthorized: "product.application.unauthorized",
});

export type ProductApplicationErrorCode =
  (typeof PRODUCT_APPLICATION_ERROR_CODES)[keyof typeof PRODUCT_APPLICATION_ERROR_CODES];

export class ProductApplicationError extends Error {
  constructor(
    public readonly code: ProductApplicationErrorCode,
    message = code,
  ) {
    super(message);
    this.name = "ProductApplicationError";
  }
}
