export {
  PURCHASE_LINE_KINDS,
  approvePurchaseDocument,
  cancelPurchaseDocument,
  confirmPurchaseDocument,
  correctPurchaseDocument,
  createPurchaseCorrectionReference,
  createPurchaseDocument,
  createPurchaseDocumentLine,
  createPurchaseSourceReference,
  reopenPurchaseDocument,
  rehydratePurchaseDocument,
  returnPurchaseDocument,
  submitPurchaseDocument,
} from "./domain/purchase-document.ts";

export type {
  CreatePurchaseCorrectionReferenceInput,
  CreatePurchaseDocumentInput,
  CreatePurchaseDocumentLineInput,
  CreatePurchaseSourceReferenceInput,
  PurchaseCorrectionReference,
  PurchaseDocumentLineSnapshot,
  PurchaseDocumentSnapshot,
  PurchaseItemType,
  PurchaseLineKind,
  PurchaseSourceReference,
} from "./domain/purchase-document.ts";

export {
  createPurchaseItemSnapshot,
  createPurchaseSupplierSnapshot,
  createPurchaseUnitSnapshot,
} from "./domain/purchase-commercial-snapshots.ts";
export type {
  CreatePurchaseItemSnapshotInput, CreatePurchaseSupplierSnapshotInput, CreatePurchaseUnitSnapshotInput,
  PurchaseItemSnapshot, PurchaseSnapshotItemType, PurchaseSupplierClassification, PurchaseSupplierSnapshot,
  PurchaseTaxTreatment, PurchaseUnitSnapshot,
} from "./domain/purchase-commercial-snapshots.ts";

export { createPurchaseCommercialTerms, normalizePurchaseQuantity } from "./domain/purchase-commercial-semantics.ts";
export type {
  CreatePurchaseCommercialTermsInput, PurchaseAdjustment, PurchaseCommercialTerms, PurchaseCommercialUnitSnapshot,
  PurchaseCurrencyCode, PurchaseMoneyRoundingMode, PurchaseMoneySnapshot, PurchaseQuantityRoundingMode,
  PurchaseQuantitySnapshot, PurchaseTaxSemantics,
} from "./domain/purchase-commercial-semantics.ts";

export {
  PURCHASE_DOCUMENT_STATUSES, PURCHASE_DOCUMENT_TRANSITIONS, PURCHASE_DOCUMENT_TYPES,
  approvePurchaseLifecycle, canTransitionPurchaseDocument, cancelPurchaseLifecycle, confirmPurchaseLifecycle,
  correctPurchaseLifecycle, createPurchaseLifecycle, reopenPurchaseLifecycle, returnPurchaseLifecycle, submitPurchaseLifecycle,
} from "./domain/purchase-lifecycle.ts";
export type {
  CreatePurchaseLifecycleInput, PurchaseDocumentStatus, PurchaseDocumentType, PurchaseLifecycleActionInput,
  PurchaseLifecycleSnapshot, PurchaseLifecycleTransitionSnapshot, PurchaseLinkedLifecycleActionInput,
} from "./domain/purchase-lifecycle.ts";

export { assertPurchaseBusinessDateAllowed, createPurchaseDocumentScope, createPurchaseNumberSeriesRequest } from "./domain/purchase-scope.ts";
export type { CreatePurchaseDocumentScopeInput, PurchaseDocumentScope, PurchaseFiscalPeriodStatus, PurchaseFiscalYearStatus, PurchaseNumberSeriesRequest } from "./domain/purchase-scope.ts";

export { calculatePurchaseDocumentTotals, calculatePurchaseLineTotals } from "./domain/purchase-pricing.ts";
export type { PurchaseDocumentTotals, PurchaseLineTotals } from "./domain/purchase-pricing.ts";

export { createPurchaseReceiptInvoiceMatch, summarizePurchaseInvoiceLineMatching } from "./domain/purchase-receipt-invoice-matching.ts";
export type {
  CreatePurchaseReceiptInvoiceMatchInput, PurchaseInvoiceLineMatchingSummary, PurchaseInvoiceMatchingLineReference,
  PurchaseReceiptInvoiceMatchSnapshot, PurchaseReceiptInvoiceMatchStatus, PurchaseReceiptMatchingLineReference,
} from "./domain/purchase-receipt-invoice-matching.ts";

export { buildPurchaseInventoryReceiptRequest, stagePurchaseInventoryReceipt } from "./domain/purchase-inventory-receipt-integration.ts";
export type {
  BuildPurchaseInventoryReceiptRequestInput, PurchaseInventoryReceiptAllocation, PurchaseInventoryReceiptCommercialFact,
  PurchaseInventoryReceiptPort, PurchaseInventoryReceiptStageLine, PurchaseInventoryReceiptStageRequest,
  PurchaseInventoryReceiptStageResult, PurchaseInventoryWarehouseReference,
} from "./domain/purchase-inventory-receipt-integration.ts";

export { createPurchaseInventoryValuationCostInput, createPurchaseInventoryValuationCostInputProvider } from "./domain/purchase-inventory-valuation-cost-input.ts";
export type {
  CreatePurchaseInventoryValuationCostInputInput, PurchaseInventoryResolvedInboundCostBasis,
  PurchaseInventoryValuationCommercialFact, PurchaseInventoryValuationCostInputProvider,
  PurchaseInventoryValuationCostInputResolver, PurchaseInventoryValuationCostInputSnapshot,
  PurchaseInventoryValuationSourceLink, PurchaseValuationMovementReference,
} from "./domain/purchase-inventory-valuation-cost-input.ts";

export {
  PURCHASE_RECEIPT_COST_RESOLUTION_STATUSES,
  PURCHASE_RECEIPT_COST_UNRESOLVED_REASONS,
  evaluatePurchaseReceiptBeforeInvoiceCost,
} from "./domain/purchase-receipt-before-invoice-policy.ts";
export type {
  PurchaseReceiptBeforeInvoiceCostDecision,
  PurchaseReceiptCostResolutionStatus,
  PurchaseReceiptCostUnresolvedReason,
} from "./domain/purchase-receipt-before-invoice-policy.ts";

export { PURCHASE_DOMAIN_ERROR_CODES, PurchaseDomainError } from "./domain/purchase-domain-errors.ts";
export type { PurchaseDomainErrorCode } from "./domain/purchase-domain-errors.ts";
