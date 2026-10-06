export const SALES_POSTING_DOMAIN_ERROR_CODES = Object.freeze({
  inputInvalid: "sales_posting.input_invalid",
  identityRequired: "sales_posting.identity_required",
  identityInvalid: "sales_posting.identity_invalid",
  sourceInvalid: "sales_posting.source_invalid",
  sourceTypeInvalid: "sales_posting.source_type_invalid",
  versionInvalid: "sales_posting.version_invalid",
  timestampInvalid: "sales_posting.timestamp_invalid",
  timestampOrderInvalid: "sales_posting.timestamp_order_invalid",
  scopeMismatch: "sales_posting.scope_mismatch",
  postingRuleInvalid: "sales_posting.posting_rule_invalid",
  postingRuleAmbiguous: "sales_posting.posting_rule_ambiguous",
  accountMappingMissing: "sales_posting.account_mapping_missing",
  accountInvalid: "sales_posting.account_invalid",
  accountNotPostable: "sales_posting.account_not_postable",
  accountResolutionMismatch: "sales_posting.account_resolution_mismatch",
  commercialPostingInvalid: "sales_posting.commercial_posting_invalid",
  commercialPostingUnbalanced: "sales_posting.commercial_posting_unbalanced",
} as const);

export type SalesPostingDomainErrorCode =
  (typeof SALES_POSTING_DOMAIN_ERROR_CODES)[keyof typeof SALES_POSTING_DOMAIN_ERROR_CODES];

export class SalesPostingDomainError extends Error {
  readonly code: SalesPostingDomainErrorCode;
  readonly field: string;

  constructor(code: SalesPostingDomainErrorCode, field: string) {
    super(`${code}:${field}`);
    this.name = "SalesPostingDomainError";
    this.code = code;
    this.field = field;
  }
}
