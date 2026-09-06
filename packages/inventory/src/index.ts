export {
  INVENTORY_DOCUMENT_TYPES,
  INVENTORY_DOMAIN_ERROR_CODES,
  InventoryDomainError,
  createInventoryDocument,
  createInventoryDocumentLine,
  createInventorySourceReference,
  rehydrateInventoryDocument,
} from "./domain/inventory-document.ts";

export type {
  CreateInventoryDocumentInput,
  CreateInventoryDocumentLineInput,
  CreateInventorySourceReferenceInput,
  InventoryDocumentLineSnapshot,
  InventoryDocumentSnapshot,
  InventoryDocumentType,
  InventoryDomainErrorCode,
  InventorySourceReference,
} from "./domain/inventory-document.ts";
