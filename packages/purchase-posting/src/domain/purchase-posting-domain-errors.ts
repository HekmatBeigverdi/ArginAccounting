export const PURCHASE_POSTING_DOMAIN_ERROR_CODES = Object.freeze({
  inputInvalid: "purchase_posting.input_invalid",
  identityRequired: "purchase_posting.identity_required",
  timestampInvalid: "purchase_posting.timestamp_invalid",
  timestampOrderInvalid: "purchase_posting.timestamp_order_invalid",
  versionInvalid: "purchase_posting.version_invalid",
  statusInvalid: "purchase_posting.status_invalid",
  stateInvalid: "purchase_posting.state_invalid",
  documentTypeInvalid: "purchase_posting.document_type_invalid",
  sourceStatusInvalid: "purchase_posting.source_status_invalid",
  snapshotInvalid: "purchase_posting.snapshot_invalid",
  scopeMismatch: "purchase_posting.scope_mismatch",
  duplicateLineId: "purchase_posting.duplicate_line_id",
  duplicateLinePosition: "purchase_posting.duplicate_line_position",
  moneyInvalid: "purchase_posting.money_invalid",
  currencyInvalid: "purchase_posting.currency_invalid",
  amountMismatch: "purchase_posting.amount_mismatch",
  quantityInvalid: "purchase_posting.quantity_invalid",
  valuationInvalid: "purchase_posting.valuation_invalid",
  sourceIdentityInvalid: "purchase_posting.source_identity_invalid",
  sourceReferenceMismatch: "purchase_posting.source_reference_mismatch",
  traceContextInvalid: "purchase_posting.trace_context_invalid",
  selfCausation: "purchase_posting.self_causation",
  eventClassificationInvalid: "purchase_posting.event_classification_invalid",
  postingRuleInvalid: "purchase_posting.posting_rule_invalid",
  postingRuleAmbiguous: "purchase_posting.posting_rule_ambiguous",
  accountMappingMissing: "purchase_posting.account_mapping_missing",
  accountInvalid: "purchase_posting.account_invalid",
  accountNotPostable: "purchase_posting.account_not_postable",
  supplierInvoiceInvalid: "purchase_posting.supplier_invoice_invalid",
  supplierInvoiceAmountInvalid: "purchase_posting.supplier_invoice_amount_invalid",
  taxPolicyInvalid: "purchase_posting.tax_policy_invalid",
  taxPolicyMissing: "purchase_posting.tax_policy_missing",
  taxPostingInvalid: "purchase_posting.tax_posting_invalid",
  chargePostingInvalid: "purchase_posting.charge_posting_invalid",
  purchaseReturnInvalid: "purchase_posting.purchase_return_invalid",
  purchaseReturnReferenceInvalid: "purchase_posting.purchase_return_reference_invalid",
  purchaseReturnAmountInvalid: "purchase_posting.purchase_return_amount_invalid",
  purchaseCorrectionInvalid: "purchase_posting.purchase_correction_invalid",
  purchaseCorrectionReferenceInvalid: "purchase_posting.purchase_correction_reference_invalid",
  purchaseCorrectionAmountInvalid: "purchase_posting.purchase_correction_amount_invalid",
  inventoryValuationMissing: "purchase_posting.inventory_valuation_missing",
  inventoryValuationMismatch: "purchase_posting.inventory_valuation_mismatch",
  inventoryValuationDirectionInvalid: "purchase_posting.inventory_valuation_direction_invalid",
  inventoryValuationAmountInvalid: "purchase_posting.inventory_valuation_amount_invalid",
  draftJournalInvalid: "purchase_posting.draft_journal_invalid",
  draftJournalComponentUnresolved: "purchase_posting.draft_journal_component_unresolved",
  draftJournalUnbalanced: "purchase_posting.draft_journal_unbalanced",
  draftJournalLineIdsInvalid: "purchase_posting.draft_journal_line_ids_invalid",
  atomicPostingInvalid: "purchase_posting.atomic_posting_invalid",
  atomicPostingScopeMismatch: "purchase_posting.atomic_posting_scope_mismatch",
  atomicPostingJournalInvalid: "purchase_posting.atomic_posting_journal_invalid",
  idempotencyInvalid: "purchase_posting.idempotency_invalid",
  idempotencyConflict: "purchase_posting.idempotency_conflict",
  replayOutcomeInvalid: "purchase_posting.replay_outcome_invalid",
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
