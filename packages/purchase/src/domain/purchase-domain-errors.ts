export const PURCHASE_DOMAIN_ERROR_CODES = Object.freeze({
  inputInvalid: "purchase.input_invalid",
  identityRequired: "purchase.identity_required",
  businessDateInvalid: "purchase.business_date_invalid",
  timestampInvalid: "purchase.timestamp_invalid",
  timestampOrderInvalid: "purchase.timestamp_order_invalid",
  versionInvalid: "purchase.version_invalid",
  lineKindInvalid: "purchase.line_kind_invalid",
  linePositionInvalid: "purchase.line_position_invalid",
  lineClassificationInvalid: "purchase.line_classification_invalid",
  duplicateLineId: "purchase.duplicate_line_id",
  duplicateLinePosition: "purchase.duplicate_line_position",
  selfReference: "purchase.self_reference",
  snapshotInvalid: "purchase.snapshot_invalid",
  supplierSnapshotMismatch: "purchase.supplier_snapshot_mismatch",
  itemSnapshotMismatch: "purchase.item_snapshot_mismatch",
  taxSnapshotInvalid: "purchase.tax_snapshot_invalid",
  taxSemanticsInvalid: "purchase.tax_semantics_invalid",
  taxpayerIdentifierInvalid: "purchase.taxpayer_identifier_invalid",
  unitSnapshotInvalid: "purchase.unit_snapshot_invalid",
  unitInvalid: "purchase.unit_invalid",
  quantityInvalid: "purchase.quantity_invalid",
  quantityPrecisionInvalid: "purchase.quantity_precision_invalid",
  currencyInvalid: "purchase.currency_invalid",
  currencyMismatch: "purchase.currency_mismatch",
  moneyInvalid: "purchase.money_invalid",
  rateInvalid: "purchase.rate_invalid",
  adjustmentInvalid: "purchase.adjustment_invalid",
  pricingInvalid: "purchase.pricing_invalid",
  documentTypeInvalid: "purchase.document_type_invalid",
  statusInvalid: "purchase.status_invalid",
  lifecycleTransitionInvalid: "purchase.lifecycle_transition_invalid",
  lifecycleHistoryInvalid: "purchase.lifecycle_history_invalid",
  lifecycleMetadataInvalid: "purchase.lifecycle_metadata_invalid",
  relatedDocumentInvalid: "purchase.related_document_invalid",
  fiscalScopeInvalid: "purchase.fiscal_scope_invalid",
  fiscalScopeBlocked: "purchase.fiscal_scope_blocked",
  fiscalDateInvalid: "purchase.fiscal_date_invalid",
  fiscalDateLocked: "purchase.fiscal_date_locked",
  scopeMismatch: "purchase.scope_mismatch",
} as const);

export type PurchaseDomainErrorCode =
  (typeof PURCHASE_DOMAIN_ERROR_CODES)[keyof typeof PURCHASE_DOMAIN_ERROR_CODES];

export class PurchaseDomainError extends Error {
  readonly code: PurchaseDomainErrorCode;
  readonly field: string;

  constructor(code: PurchaseDomainErrorCode, field: string) {
    super(`${code}:${field}`);
    this.name = "PurchaseDomainError";
    this.code = code;
    this.field = field;
  }
}
