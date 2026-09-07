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

export { normalizeInventoryQuantity, createInventoryQuantitySnapshot, rehydrateInventoryQuantitySnapshot } from "./domain/inventory-quantity.ts";
export type { InventoryUnitSnapshot, InventoryQuantitySnapshot } from "./domain/inventory-quantity.ts";
export { assertInventoryProductEligible, validateInventoryWarehouseReference, createInventoryLineOperation, rehydrateInventoryLineOperation } from "./domain/inventory-operation.ts";
export type { InventoryProductReference, InventoryWarehouseResolution, InventoryLineOperationSnapshot } from "./domain/inventory-operation.ts";

export { createInventoryDocumentScope } from "./domain/inventory-scope.ts";
export type { InventoryDocumentScope, CreateInventoryDocumentScopeInput } from "./domain/inventory-scope.ts";
export { validateInventoryDocumentScope } from "./application/inventory-scope-validation.ts";
export type { InventoryScopeReaders, InventoryScopeContext, ScopedInventoryDocument } from "./application/inventory-scope-validation.ts";
export { reserveInventoryDocumentNumber, INVENTORY_NUMBER_SERIES_TYPES, DEFAULT_INVENTORY_NUMBER_SERIES_DEFINITIONS } from "./application/inventory-numbering.ts";
export type { InventoryNumberReservation } from "./application/inventory-numbering.ts";
