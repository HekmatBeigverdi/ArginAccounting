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
  PURCHASE_DOCUMENT_STATUSES,
  PURCHASE_DOCUMENT_TRANSITIONS,
  PURCHASE_DOCUMENT_TYPES,
  approvePurchaseLifecycle,
  canTransitionPurchaseDocument,
  cancelPurchaseLifecycle,
  confirmPurchaseLifecycle,
  correctPurchaseLifecycle,
  createPurchaseLifecycle,
  reopenPurchaseLifecycle,
  returnPurchaseLifecycle,
  submitPurchaseLifecycle,
} from "./domain/purchase-lifecycle.ts";

export type {
  CreatePurchaseLifecycleInput,
  PurchaseDocumentStatus,
  PurchaseDocumentType,
  PurchaseLifecycleActionInput,
  PurchaseLifecycleSnapshot,
  PurchaseLifecycleTransitionSnapshot,
  PurchaseLinkedLifecycleActionInput,
} from "./domain/purchase-lifecycle.ts";

export {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
} from "./domain/purchase-domain-errors.ts";

export type { PurchaseDomainErrorCode } from "./domain/purchase-domain-errors.ts";
