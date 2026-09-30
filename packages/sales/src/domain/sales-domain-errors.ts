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
