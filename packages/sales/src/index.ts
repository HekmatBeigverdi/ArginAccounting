export {
  SALES_DOCUMENT_TYPES,
  SALES_LINE_KINDS,
  createSalesDocument,
  createSalesDocumentLine,
} from "./domain/sales-document.ts";
export type {
  CreateSalesDocumentInput,
  CreateSalesDocumentLineInput,
  SalesCustomerReference,
  SalesDocumentLineSnapshot,
  SalesDocumentScope,
  SalesDocumentSnapshot,
  SalesDocumentType,
  SalesItemReference,
  SalesItemType,
  SalesLineKind,
} from "./domain/sales-document.ts";
export { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./domain/sales-domain-errors.ts";
export type { SalesDomainErrorCode } from "./domain/sales-domain-errors.ts";
