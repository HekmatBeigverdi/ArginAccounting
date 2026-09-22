export {
  PURCHASE_POSTING_STATUSES,
  createPurchasePosting,
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
  createPurchasePostingSourceLineReference,
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
