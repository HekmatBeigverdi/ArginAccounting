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
