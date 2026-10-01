export {
  SALES_DOCUMENT_TYPES,
  SALES_LINE_KINDS,
  createSalesDocument,
  createSalesDocumentLine,
  createSalesRelatedDocumentReference,
  createSalesSourceReference,
} from "./domain/sales-document.ts";
export type {
  CreateSalesDocumentInput,
  CreateSalesDocumentLineInput,
  CreateSalesRelatedDocumentReferenceInput,
  CreateSalesSourceReferenceInput,
  SalesCustomerReference,
  SalesDocumentLineSnapshot,
  SalesDocumentScope,
  SalesDocumentSnapshot,
  SalesDocumentType,
  SalesItemReference,
  SalesItemType,
  SalesLineKind,
  SalesRelatedDocumentReference,
  SalesSourceReference,
} from "./domain/sales-document.ts";
export { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./domain/sales-domain-errors.ts";
export type { SalesDomainErrorCode } from "./domain/sales-domain-errors.ts";

export { createSalesCustomerSnapshot } from "./domain/sales-customer.ts";
export type { SalesCustomerSnapshot } from "./domain/sales-customer.ts";

export {
  SALES_PRICE_LIST_KINDS,
  createSalesPriceList,
  createSalesPriceListItem,
} from "./domain/sales-price-list.ts";
export type {
  CreateSalesPriceListInput,
  CreateSalesPriceListItemInput,
  SalesPriceList,
  SalesPriceListItem,
  SalesPriceListKind,
} from "./domain/sales-price-list.ts";

export {
  SALES_PRICE_LIST_RESOLUTION_PRIORITY,
  resolveSalesPriceList,
} from "./domain/sales-price-resolution.ts";
export type {
  SalesPriceListResolutionCandidate,
  SalesResolvedPrice,
} from "./domain/sales-price-resolution.ts";

export {
  createSalesPriceRevision,
  isSalesPriceRevisionEffective,
} from "./domain/sales-price-revision.ts";
export type {
  CreateSalesPriceRevisionInput,
  SalesPriceRevision,
} from "./domain/sales-price-revision.ts";

export {
  createSalesPriceListTarget,
  isSalesPriceListTargetEligible,
} from "./domain/sales-price-target.ts";
export type {
  SalesPriceListTarget,
  SalesPricingContext,
} from "./domain/sales-price-target.ts";

export {
  createSalesCommercialTerms,
  createSalesCommercialTermsFromResolvedPrice,
} from "./domain/sales-commercial-terms.ts";
export type {
  CreateSalesCommercialTermsInput,
  SalesCommercialTerms,
  SalesPriceOrigin,
} from "./domain/sales-commercial-terms.ts";

export {
  createSalesCharge,
  createSalesDiscount,
  createSalesTax,
} from "./domain/sales-adjustments.ts";
export type {
  CreateSalesAdjustmentInput,
  CreateSalesTaxInput,
  SalesAdjustmentMode,
  SalesCharge,
  SalesDiscount,
  SalesTax,
} from "./domain/sales-adjustments.ts";

export {
  SALES_MONEY_ROUNDING_MODE,
  calculateSalesDocumentTotals,
  calculateSalesLineTotals,
} from "./domain/sales-pricing.ts";
export type {
  SalesDocumentTotals,
  SalesLineTotals,
} from "./domain/sales-pricing.ts";

export { createSalesCommercialSnapshot, verifySalesCommercialSnapshot } from "./domain/sales-commercial-snapshot.ts";
export type { CreateSalesCommercialSnapshotInput, SalesCommercialSnapshot } from "./domain/sales-commercial-snapshot.ts";

export { createSalesOrder } from "./domain/sales-order.ts";
export type { CreateSalesOrderInput, SalesOrder } from "./domain/sales-order.ts";

export { createSalesInvoice } from "./domain/sales-invoice.ts";
export type { CreateSalesInvoiceInput, SalesInvoice } from "./domain/sales-invoice.ts";

export { createSalesReturn } from "./domain/sales-return.ts";
export type { CreateSalesReturnInput, SalesReturn } from "./domain/sales-return.ts";
