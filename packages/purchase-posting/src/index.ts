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
