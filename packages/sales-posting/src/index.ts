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
