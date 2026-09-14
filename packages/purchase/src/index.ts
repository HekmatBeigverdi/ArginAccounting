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
  createPurchaseItemSnapshot,
  createPurchaseSupplierSnapshot,
  createPurchaseUnitSnapshot,
} from "./domain/purchase-commercial-snapshots.ts";

export type {
  CreatePurchaseItemSnapshotInput,
  CreatePurchaseSupplierSnapshotInput,
  CreatePurchaseUnitSnapshotInput,
  PurchaseItemSnapshot,
  PurchaseSnapshotItemType,
  PurchaseSupplierClassification,
  PurchaseSupplierSnapshot,
  PurchaseTaxTreatment,
  PurchaseUnitSnapshot,
} from "./domain/purchase-commercial-snapshots.ts";

export {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
} from "./domain/purchase-domain-errors.ts";

export type { PurchaseDomainErrorCode } from "./domain/purchase-domain-errors.ts";
