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
  stockFulfillmentInvalid: "sales_posting.stock_fulfillment_invalid",
  stockFulfillmentBlocked: "sales_posting.stock_fulfillment_blocked",
  inventoryIssueLineageInvalid: "sales_posting.inventory_issue_lineage_invalid",
  inventoryIssueLineageMissing: "sales_posting.inventory_issue_lineage_missing",
  inventoryIssueLineageAmbiguous: "sales_posting.inventory_issue_lineage_ambiguous",
  inventoryMovementLineageInvalid: "sales_posting.inventory_movement_lineage_invalid",
  inventoryMovementLineageMissing: "sales_posting.inventory_movement_lineage_missing",
  inventoryMovementLineageAmbiguous: "sales_posting.inventory_movement_lineage_ambiguous",
  valuationPrerequisiteInvalid: "sales_posting.valuation_prerequisite_invalid",
  valuationPrerequisiteMissing: "sales_posting.valuation_prerequisite_missing",
  valuationPrerequisiteUnresolved: "sales_posting.valuation_prerequisite_unresolved",
  costPostingInvalid: "sales_posting.cost_posting_invalid",
  costPostingUnbalanced: "sales_posting.cost_posting_unbalanced",
  mixedInvoiceInvalid: "sales_posting.mixed_invoice_invalid",
  mixedInvoiceMismatch: "sales_posting.mixed_invoice_mismatch",
  serviceOnlyInvalid: "sales_posting.service_only_invalid",
  serviceOnlyMismatch: "sales_posting.service_only_mismatch",
  orchestrationInvalid: "sales_posting.orchestration_invalid",
  orchestrationMismatch: "sales_posting.orchestration_mismatch",
  idempotencyInvalid: "sales_posting.idempotency_invalid",
  idempotencyConflict: "sales_posting.idempotency_conflict",
  replayOutcomeInvalid: "sales_posting.replay_outcome_invalid",
  concurrencyConflict: "sales_posting.concurrency_conflict",
  concurrencyStateMismatch: "sales_posting.concurrency_state_mismatch",
  atomicCommitInvalid: "sales_posting.atomic_commit_invalid",
  atomicCommitConflict: "sales_posting.atomic_commit_conflict",
  outboxInvalid: "sales_posting.outbox_invalid",
  salesReturnInvalid: "sales_posting.sales_return_invalid",
  salesReturnLineageInvalid: "sales_posting.sales_return_lineage_invalid",
  salesReturnCommercialUnbalanced: "sales_posting.sales_return_commercial_unbalanced",
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
