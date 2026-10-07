export {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./domain/sales-posting-domain-errors.ts";
export type {
  SalesPostingDomainErrorCode,
} from "./domain/sales-posting-domain-errors.ts";

export {
  SALES_POSTING_SOURCE_SYSTEM,
  SALES_POSTING_SOURCE_TYPES,
  createSalesPostingSourceIdentity,
  salesPostingSourceIdentityKey,
} from "./domain/sales-posting-source.ts";
export type {
  CreateSalesPostingSourceIdentityInput,
  SalesPostingSourceIdentity,
  SalesPostingSourceType,
} from "./domain/sales-posting-source.ts";

export {
  createSalesPosting,
  rehydrateSalesPosting,
} from "./domain/sales-posting.ts";
export type {
  CreateSalesPostingInput,
  RehydrateSalesPostingInput,
  SalesPostingAggregate,
} from "./domain/sales-posting.ts";

export {
  createSalesCommercialPostingInput,
} from "./domain/sales-commercial-posting-input.ts";
export type {
  CreateSalesCommercialPostingInputArgs,
  SalesCommercialPostingInput,
  SalesCommercialPostingLineInput,
} from "./domain/sales-commercial-posting-input.ts";

export {
  SALES_REVENUE_ACCOUNT_ROLE,
  createSalesRevenueAccountRule,
  resolveSalesRevenueAccount,
  selectSalesRevenueAccountRule,
} from "./domain/sales-revenue-account-resolution.ts";
export type {
  SalesPostingAccountReader,
  SalesPostingAccountSnapshot,
  SalesRevenueAccountResolution,
  SalesRevenueAccountResolutionContext,
  SalesRevenueAccountRole,
  SalesRevenueAccountRule,
} from "./domain/sales-revenue-account-resolution.ts";

export {
  SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
  createSalesAccountsReceivableAccountRule,
  resolveSalesAccountsReceivableAccount,
  selectSalesAccountsReceivableAccountRule,
} from "./domain/sales-accounts-receivable-resolution.ts";
export type {
  SalesAccountsReceivableAccountRole,
  SalesAccountsReceivableAccountRule,
  SalesAccountsReceivableResolution,
  SalesAccountsReceivableResolutionContext,
} from "./domain/sales-accounts-receivable-resolution.ts";

export {
  SALES_OUTPUT_VAT_ACCOUNT_ROLE,
  createSalesOutputVatAccountRule,
  resolveSalesOutputVatAccount,
  selectSalesOutputVatAccountRule,
} from "./domain/sales-output-vat-account-resolution.ts";
export type {
  SalesOutputVatAccountResolution,
  SalesOutputVatAccountRole,
  SalesOutputVatAccountRule,
  SalesOutputVatResolutionContext,
} from "./domain/sales-output-vat-account-resolution.ts";

export {
  calculateSalesCommercialPosting,
} from "./domain/sales-commercial-posting-calculation.ts";
export type {
  CalculateSalesCommercialPostingInput,
  SalesCommercialPostingCalculation,
  SalesCommercialPostingComponent,
  SalesCommercialPostingComponentRole,
  SalesCommercialPostingSide,
  SalesOutputVatResolutionForLine,
  SalesRevenueResolutionForLine,
} from "./domain/sales-commercial-posting-calculation.ts";

export {
  assertSalesStockFulfillmentEligible,
  evaluateSalesStockFulfillmentPrerequisite,
} from "./domain/sales-stock-fulfillment-prerequisite.ts";
export type {
  SalesStockFulfillmentEvidence,
  SalesStockFulfillmentLinePrerequisite,
  SalesStockFulfillmentLineStatus,
  SalesStockFulfillmentPrerequisiteResult,
} from "./domain/sales-stock-fulfillment-prerequisite.ts";

export {
  resolveSalesInventoryIssueLineage,
} from "./domain/sales-inventory-issue-lineage.ts";
export type {
  SalesInventoryIssueDocumentReader,
  SalesInventoryIssueLineage,
  SalesInventoryIssueLineageResult,
} from "./domain/sales-inventory-issue-lineage.ts";

export {
  resolveSalesOutboundInventoryMovementLineage,
} from "./domain/sales-inventory-movement-lineage.ts";
export type {
  SalesInventoryMovementReader,
  SalesOutboundInventoryMovementLineage,
  SalesOutboundInventoryMovementLineageResult,
} from "./domain/sales-inventory-movement-lineage.ts";

export {
  resolveSalesResolvedValuationPrerequisite,
} from "./domain/sales-resolved-valuation-prerequisite.ts";
export type {
  SalesResolvedValuationLineage,
  SalesResolvedValuationPrerequisiteResult,
} from "./domain/sales-resolved-valuation-prerequisite.ts";

export {
  SALES_COGS_ACCOUNT_ROLE,
  createSalesCogsAccountRule,
  resolveSalesCogsAccount,
  selectSalesCogsAccountRule,
} from "./domain/sales-cogs-account-resolution.ts";
export type {
  SalesCogsAccountResolution,
  SalesCogsAccountResolutionContext,
  SalesCogsAccountRole,
  SalesCogsAccountRule,
} from "./domain/sales-cogs-account-resolution.ts";

export {
  SALES_INVENTORY_ACCOUNT_ROLE,
  createSalesInventoryAccountRule,
  resolveSalesInventoryAccount,
  selectSalesInventoryAccountRule,
} from "./domain/sales-inventory-account-resolution.ts";
export type {
  SalesInventoryAccountResolution,
  SalesInventoryAccountResolutionContext,
  SalesInventoryAccountRole,
  SalesInventoryAccountRule,
} from "./domain/sales-inventory-account-resolution.ts";

export {
  calculateSalesCostPosting,
} from "./domain/sales-cost-posting-calculation.ts";
export type {
  CalculateSalesCostPostingInput,
  SalesCogsResolutionForLine,
  SalesCostPostingCalculation,
  SalesCostPostingComponent,
  SalesCostPostingComponentRole,
  SalesCostPostingSide,
  SalesInventoryResolutionForLine,
} from "./domain/sales-cost-posting-calculation.ts";

export {
  orchestrateMixedSalesInvoicePosting,
} from "./domain/sales-mixed-invoice-orchestration.ts";
export type {
  SalesMixedInvoicePostingResult,
} from "./domain/sales-mixed-invoice-orchestration.ts";

export {
  orchestrateServiceOnlySalesInvoicePosting,
} from "./domain/sales-service-only-posting.ts";
export type {
  SalesServiceOnlyPostingResult,
} from "./domain/sales-service-only-posting.ts";

export {
  SALES_POSTING_ORCHESTRATION_STATUSES,
  SALES_POSTING_PENDING_REASONS,
  orchestrateSalesPostFinalization,
} from "./application/post-finalization-orchestrator.ts";
export type {
  OrchestrateSalesPostFinalizationInput,
  SalesPostingInvoicePath,
  SalesPostingOrchestrationStatus,
  SalesPostingPendingReason,
  SalesPostingPendingState,
  SalesPostingPostFinalizationState,
  SalesPostingReadyState,
} from "./application/post-finalization-orchestrator.ts";

export {
  SALES_POSTING_PURPOSES,
  assertSalesPostingReplayCompatible,
  createSalesPostingIdempotencyIdentity,
  createSalesPostingIdempotencyKey,
  createSalesPostingIdempotencyRecord,
} from "./domain/sales-posting-idempotency.ts";
export type {
  SalesPostingIdempotencyIdentity,
  SalesPostingIdempotencyRecord,
  SalesPostingPurpose,
} from "./domain/sales-posting-idempotency.ts";

export {
  resolveSalesPostingJournalEffect,
} from "./application/replay-safe-journal-effect.ts";
export type {
  ResolveSalesPostingJournalEffectInput,
  SalesPostingJournalEffectResolution,
  SalesPostingReplayStore,
} from "./application/replay-safe-journal-effect.ts";

export {
  applySalesPostingCompareAndSwap,
  assertSalesPostingConcurrency,
} from "./domain/sales-posting-concurrency.ts";
export type {
  SalesPostingConcurrencyExpectation,
} from "./domain/sales-posting-concurrency.ts";

export {
  prepareSalesPostingMutation,
} from "./application/prepare-posting-mutation.ts";
export type {
  PrepareSalesPostingMutationDecision,
  PrepareSalesPostingMutationInput,
  SalesPostingReplayReader,
} from "./application/prepare-posting-mutation.ts";

export {
  commitSalesPostingAccountingEffectAtomic,
} from "./application/atomic-posting-unit-of-work.ts";
export type {
  CommitSalesPostingAccountingEffectInput,
  CommitSalesPostingAccountingEffectResult,
  SalesPostingAtomicSession,
  SalesPostingAtomicUnitOfWork,
  SalesPostingOutboxEvent,
} from "./application/atomic-posting-unit-of-work.ts";

export {
  createSalesReturnCommercialLineage,
  reverseSalesReturnCommercialPosting,
} from "./domain/sales-return-commercial-reversal.ts";
export type {
  SalesReturnCommercialLineage,
  SalesReturnCommercialReversal,
  SalesReturnCommercialReversalComponent,
} from "./domain/sales-return-commercial-reversal.ts";

export {
  calculateSalesReturnCostRestoration,
  resolveSalesReturnReceiptValuation,
} from "./domain/sales-return-cost-restoration.ts";
export type {
  SalesReturnCogsResolutionForLine,
  SalesReturnCostRestoration,
  SalesReturnCostRestorationComponent,
  SalesReturnInventoryResolutionForLine,
  SalesReturnMovementReader,
  SalesReturnReceiptMovementLineage,
  SalesReturnResolvedValuationLineage,
} from "./domain/sales-return-cost-restoration.ts";

export {
  createSalesCorrectionLineage,
  createSalesCorrectionReplacementPlan,
} from "./domain/sales-correction-lineage.ts";
export type {
  SalesCorrectionLineage,
  SalesCorrectionLineageLine,
  SalesCorrectionReplacementPlan,
} from "./domain/sales-correction-lineage.ts";
