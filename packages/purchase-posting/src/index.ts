export {
  PURCHASE_POSTING_STATUSES,
  createPurchasePosting,
  preparePurchasePosting,
  rehydratePurchasePosting,
} from "./domain/purchase-posting.ts";
export type {
  CreatePurchasePostingInput,
  PurchasePostingAggregate,
  PurchasePostingStatus,
  RehydratePurchasePostingInput,
} from "./domain/purchase-posting.ts";

export {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
} from "./domain/purchase-posting-domain-errors.ts";
export type {
  PurchasePostingDomainErrorCode,
} from "./domain/purchase-posting-domain-errors.ts";

export {
  PURCHASE_POSTING_LINE_KINDS,
  PURCHASE_POSTING_SOURCE_DOCUMENT_TYPES,
  PURCHASE_POSTING_SOURCE_STATUSES,
  createPurchasePostingCommercialAmountsSnapshot,
  createPurchasePostingFact,
  createPurchasePostingItemSnapshot,
  createPurchasePostingLineFactSnapshot,
  createPurchasePostingSupplierSnapshot,
  createPurchasePostingValuationSnapshot,
} from "./domain/purchase-posting-facts.ts";
export type {
  CreatePurchasePostingFactInput,
  PurchasePostingCommercialAmountsSnapshot,
  PurchasePostingFactSnapshot,
  PurchasePostingItemSnapshot,
  PurchasePostingItemType,
  PurchasePostingLineFactSnapshot,
  PurchasePostingLineKind,
  PurchasePostingMoneySnapshot,
  PurchasePostingSourceDocumentType,
  PurchasePostingSourceStatus,
  PurchasePostingSupplierSnapshot,
  PurchasePostingValuationMethod,
  PurchasePostingValuationSnapshot,
} from "./domain/purchase-posting-facts.ts";

export {
  PURCHASE_POSTING_SOURCE_SYSTEM,
  assertPurchasePostingLineReferenceMatchesFact,
  assertPurchasePostingSourceMatchesFact,
  createPurchasePostingSourceIdentity,
  createPurchasePostingSourceIdentityFromFact,
  createPurchasePostingSourceLineReference,
  createPurchasePostingSourceLineReferenceFromFact,
  createPurchasePostingSourceReference,
  createPurchasePostingTraceContext,
  purchasePostingSourceIdentityKey,
} from "./domain/purchase-posting-source-reference.ts";
export type {
  CreatePurchasePostingSourceIdentityInput,
  CreatePurchasePostingSourceLineReferenceInput,
  CreatePurchasePostingSourceReferenceInput,
  CreatePurchasePostingTraceContextInput,
  PurchasePostingSourceIdentity,
  PurchasePostingSourceLineReference,
  PurchasePostingSourceReference,
  PurchasePostingTraceContext,
} from "./domain/purchase-posting-source-reference.ts";

export {
  PURCHASE_POSTING_EVENT_DISPOSITIONS,
  PURCHASE_POSTING_EVENT_KINDS,
  PURCHASE_POSTING_EVENT_REASON_CODES,
  classifyPurchasePostingEvent,
  classifyPurchasePostingFact,
  isPurchasePostingEventEligible,
} from "./domain/purchase-posting-event-classification.ts";
export type {
  ClassifyPurchasePostingEventInput,
  PurchasePostingEventClassification,
  PurchasePostingEventDisposition,
  PurchasePostingEventKind,
  PurchasePostingEventReasonCode,
} from "./domain/purchase-posting-event-classification.ts";

export {
  PURCHASE_POSTING_ACCOUNT_ROLES,
  createPurchasePostingRule,
  resolvePurchasePostingAccount,
  selectPurchasePostingRule,
} from "./domain/purchase-posting-rules.ts";
export type {
  CreatePurchasePostingRuleInput,
  PurchasePostingAccountReader,
  PurchasePostingAccountResolution,
  PurchasePostingAccountResolutionContext,
  PurchasePostingAccountRole,
  PurchasePostingAccountSnapshot,
  PurchasePostingRule,
} from "./domain/purchase-posting-rules.ts";

export {
  createSupplierInvoicePostingPlan,
} from "./domain/supplier-invoice-posting.ts";
export type {
  SupplierInvoiceAmountBasis,
  SupplierInvoicePostingComponent,
  SupplierInvoicePostingPlan,
  SupplierInvoicePostingSide,
} from "./domain/supplier-invoice-posting.ts";

export {
  PURCHASE_TAX_RECOVERABILITY,
  createPurchaseTaxPolicy,
  createPurchaseTaxPostingPlan,
} from "./domain/purchase-tax-posting.ts";
export type {
  CreatePurchaseTaxPolicyInput,
  PurchaseTaxPolicy,
  PurchaseTaxPostingComponent,
  PurchaseTaxPostingDestination,
  PurchaseTaxPostingPlan,
  PurchaseTaxRecoverability,
} from "./domain/purchase-tax-posting.ts";

export {
  createPurchaseChargePostingPlan,
} from "./domain/purchase-charge-posting.ts";
export type {
  PurchaseChargePostingComponent,
  PurchaseChargePostingDestination,
  PurchaseChargePostingPlan,
} from "./domain/purchase-charge-posting.ts";

export {
  createPurchaseReturnPostingPlan,
} from "./domain/purchase-return-posting.ts";
export type {
  PurchaseReturnAmountBasis,
  PurchaseReturnPostingComponent,
  PurchaseReturnPostingPlan,
  PurchaseReturnPostingSide,
  PurchaseReturnSourceReference,
} from "./domain/purchase-return-posting.ts";

export {
  PURCHASE_CORRECTION_EFFECTS,
  createPurchaseCorrectionPostingPlan,
} from "./domain/purchase-correction-posting.ts";
export type {
  PurchaseCorrectionAmountBasis,
  PurchaseCorrectionEffect,
  PurchaseCorrectionLineLink,
  PurchaseCorrectionPostingComponent,
  PurchaseCorrectionPostingPlan,
  PurchaseCorrectionPostingSide,
  PurchaseCorrectionSourceReference,
} from "./domain/purchase-correction-posting.ts";

export {
  resolvePurchaseCorrectionInventoryValuation,
  resolvePurchaseReturnInventoryValuation,
  resolveSupplierInvoiceInventoryValuation,
} from "./domain/inventory-valuation-integration.ts";
export type {
  PurchasePostingResolvedValuation,
  ResolvedPurchaseCorrectionPostingPlan,
  ResolvedPurchaseReturnPostingPlan,
  ResolvedSupplierInvoicePostingPlan,
} from "./domain/inventory-valuation-integration.ts";

export {
  createPurchaseCorrectionDraftComponents,
  createPurchasePostingDraftJournal,
  createPurchaseReturnDraftComponents,
  createSupplierInvoiceDraftComponents,
} from "./domain/draft-journal-generation.ts";
export type {
  CreatePurchasePostingDraftJournalInput,
  PurchasePostingDraftComponent,
  PurchasePostingDraftJournalMetadata,
} from "./domain/draft-journal-generation.ts";

export {
  commitPurchasePostingJournalDraftAtomically,
} from "./application/atomic-journal-posting.ts";
export type {
  CommitPurchasePostingJournalDraftInput,
  CommitPurchasePostingJournalDraftResult,
  PurchasePostingAtomicSession,
  PurchasePostingAtomicUnitOfWork,
} from "./application/atomic-journal-posting.ts";
