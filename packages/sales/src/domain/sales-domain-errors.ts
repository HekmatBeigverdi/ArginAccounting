export const SALES_DOMAIN_ERROR_CODES = Object.freeze({
  inputInvalid: "sales.input_invalid",
  identityRequired: "sales.identity_required",
  documentTypeInvalid: "sales.document_type_invalid",
  lineKindInvalid: "sales.line_kind_invalid",
  linePositionInvalid: "sales.line_position_invalid",
  lineClassificationInvalid: "sales.line_classification_invalid",
  duplicateLineId: "sales.duplicate_line_id",
  duplicateLinePosition: "sales.duplicate_line_position",
  businessDateInvalid: "sales.business_date_invalid",
  scopeMismatch: "sales.scope_mismatch",
  selfReference: "sales.self_reference",
  customerInvalid: "sales.customer_invalid",
  customerRoleRequired: "sales.customer_role_required",
  priceListKindInvalid: "sales.price_list_kind_invalid",
  priceInvalid: "sales.price_invalid",
  duplicatePriceListItemId: "sales.duplicate_price_list_item_id",
  duplicatePriceListProduct: "sales.duplicate_price_list_product",
  priceResolutionAmbiguous: "sales.price_resolution_ambiguous",
  priceCurrencyInvalid: "sales.price_currency_invalid",
  priceEffectiveDateInvalid: "sales.price_effective_date_invalid",
  priceRevisionInvalid: "sales.price_revision_invalid",
  duplicatePriceRevision: "sales.duplicate_price_revision",
  priceRevisionOverlap: "sales.price_revision_overlap",
  priceListTargetInvalid: "sales.price_list_target_invalid",
  salesQuantityInvalid: "sales.quantity_invalid",
  priceOriginInvalid: "sales.price_origin_invalid",
  adjustmentModeInvalid: "sales.adjustment_mode_invalid",
  adjustmentValueInvalid: "sales.adjustment_value_invalid",
  taxRateInvalid: "sales.tax_rate_invalid",
  duplicateCommercialAdjustmentId: "sales.duplicate_commercial_adjustment_id",
  pricingCalculationInvalid: "sales.pricing_calculation_invalid",
  currencyMismatch: "sales.currency_mismatch",
} as const);

export type SalesDomainErrorCode =
  (typeof SALES_DOMAIN_ERROR_CODES)[keyof typeof SALES_DOMAIN_ERROR_CODES];

export class SalesDomainError extends Error {
  readonly code: SalesDomainErrorCode;
  readonly field: string;

  constructor(code: SalesDomainErrorCode, field: string) {
    super(`${code}:${field}`);
    this.name = "SalesDomainError";
    this.code = code;
    this.field = field;
  }
}
