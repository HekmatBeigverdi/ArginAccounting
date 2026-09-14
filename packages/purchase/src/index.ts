export {
  PURCHASE_LINE_KINDS,
  createPurchaseCorrectionReference,
  createPurchaseDocument,
  createPurchaseDocumentLine,
  createPurchaseSourceReference,
  rehydratePurchaseDocument,
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
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
} from "./domain/purchase-domain-errors.ts";

export type { PurchaseDomainErrorCode } from "./domain/purchase-domain-errors.ts";
