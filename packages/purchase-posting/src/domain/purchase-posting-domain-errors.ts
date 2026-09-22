export const PURCHASE_POSTING_DOMAIN_ERROR_CODES = Object.freeze({
  inputInvalid: "purchase_posting.input_invalid",
  identityRequired: "purchase_posting.identity_required",
  timestampInvalid: "purchase_posting.timestamp_invalid",
  timestampOrderInvalid: "purchase_posting.timestamp_order_invalid",
  versionInvalid: "purchase_posting.version_invalid",
  statusInvalid: "purchase_posting.status_invalid",
  stateInvalid: "purchase_posting.state_invalid",
} as const);

export type PurchasePostingDomainErrorCode =
  (typeof PURCHASE_POSTING_DOMAIN_ERROR_CODES)[keyof typeof PURCHASE_POSTING_DOMAIN_ERROR_CODES];

export class PurchasePostingDomainError extends Error {
  readonly code: PurchasePostingDomainErrorCode;
  readonly field: string;

  constructor(code: PurchasePostingDomainErrorCode, field: string) {
    super(`${code}:${field}`);
    this.name = "PurchasePostingDomainError";
    this.code = code;
    this.field = field;
  }
}
