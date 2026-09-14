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
