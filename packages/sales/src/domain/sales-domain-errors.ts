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
  commercialSnapshotInvalid: "sales.commercial_snapshot_invalid",
  commercialTermsRequired: "sales.commercial_terms_required",
  salesOrderLinesRequired: "sales.order_lines_required",
  salesInvoiceLinesRequired: "sales.invoice_lines_required",
  salesReturnLinesRequired: "sales.return_lines_required",
  salesReturnInvoiceRequired: "sales.return_invoice_required",
  salesReturnInvoiceLineRequired: "sales.return_invoice_line_required",
  salesCorrectionLinesRequired: "sales.correction_lines_required",
  salesCorrectionInvoiceRequired: "sales.correction_invoice_required",
  salesCorrectionInvoiceLineRequired: "sales.correction_invoice_line_required",
  lifecycleTransitionInvalid: "sales.lifecycle_transition_invalid",
  lifecycleTransitionDuplicate: "sales.lifecycle_transition_duplicate",
  lifecycleTimestampInvalid: "sales.lifecycle_timestamp_invalid",
  inventoryIssueFinalizedInvoiceRequired: "sales.inventory_issue_finalized_invoice_required",
  inventoryIssueStockLinesRequired: "sales.inventory_issue_stock_lines_required",
  inventoryIssueRoutingMismatch: "sales.inventory_issue_routing_mismatch",
  inventoryReturnReceiptFinalizedReturnRequired: "sales.inventory_return_receipt_finalized_return_required",
  inventoryReturnReceiptStockLinesRequired: "sales.inventory_return_receipt_stock_lines_required",
  inventoryReturnReceiptRoutingMismatch: "sales.inventory_return_receipt_routing_mismatch",
  inventoryCostResolvedOutboundRequired: "sales.inventory_cost_resolved_outbound_required",
  inventoryCostLineageMismatch: "sales.inventory_cost_lineage_mismatch",
  fulfillmentOrderRelationMismatch: "sales.fulfillment_order_relation_mismatch",
  fulfillmentOrderLineMismatch: "sales.fulfillment_order_line_mismatch",
  fulfillmentOverInvoice: "sales.fulfillment_over_invoice",
  fulfillmentInvoiceRelationMismatch: "sales.fulfillment_invoice_relation_mismatch",
  fulfillmentInvoiceLineMismatch: "sales.fulfillment_invoice_line_mismatch",
  fulfillmentOverReturn: "sales.fulfillment_over_return",
  idempotencyConflict: "sales.idempotency_conflict",
  idempotencyResultInvalid: "sales.idempotency_result_invalid",
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
