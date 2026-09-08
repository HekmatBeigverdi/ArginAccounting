export {
  INVENTORY_DOCUMENT_TYPES,
  INVENTORY_DOCUMENT_STATUSES,
  INVENTORY_DOCUMENT_TRANSITIONS,
  INVENTORY_DOMAIN_ERROR_CODES,
  InventoryDomainError,
  approveInventoryDocument,
  assertInventoryDocumentDeletable,
  assertInventoryDocumentEditable,
  canTransitionInventoryDocument,
  cancelInventoryDocument,
  confirmInventoryDocument,
  createInventoryDocument,
  createInventoryDocumentLine,
  createInventorySourceReference,
  rehydrateInventoryDocument,
  returnInventoryDocumentToDraft,
  reverseInventoryDocument,
  submitInventoryDocument,
} from "./domain/inventory-document.ts";

export type {
  CreateInventoryDocumentInput,
  CreateInventoryDocumentLineInput,
  CreateInventorySourceReferenceInput,
  InventoryDocumentLineSnapshot,
  InventoryDocumentSnapshot,
  InventoryDocumentStatus,
  InventoryDocumentType,
  InventoryDomainErrorCode,
  InventoryLifecycleActionInput,
  InventoryLifecycleTransitionSnapshot,
  InventorySourceReference,
  ReverseInventoryDocumentInput,
} from "./domain/inventory-document.ts";

export { normalizeInventoryQuantity, createInventoryQuantitySnapshot, rehydrateInventoryQuantitySnapshot } from "./domain/inventory-quantity.ts";
export type { InventoryUnitSnapshot, InventoryQuantitySnapshot } from "./domain/inventory-quantity.ts";
export { assertInventoryProductEligible, validateInventoryWarehouseReference, createInventoryLineOperation, rehydrateInventoryLineOperation } from "./domain/inventory-operation.ts";
export type { InventoryProductReference, InventoryWarehouseResolution, InventoryLineOperationSnapshot } from "./domain/inventory-operation.ts";

export {
  addInventoryStockQuantities,
  appendInventoryStockMovement,
  compareInventoryStockMovements,
  createInventoryStockKey,
  createInventoryStockMovement,
  getInventoryStockBalance,
  rebuildInventoryStockLedger,
  rehydrateInventoryStockMovement,
  serializeInventoryStockKey,
} from "./domain/inventory-stock.ts";
export type {
  CreateInventoryStockMovementInput,
  InventoryStockBalanceSnapshot,
  InventoryStockKey,
  InventoryStockLedgerSnapshot,
  InventoryStockMovementSnapshot,
} from "./domain/inventory-stock.ts";

export { createInventoryDocumentScope } from "./domain/inventory-scope.ts";
export type { InventoryDocumentScope, CreateInventoryDocumentScopeInput } from "./domain/inventory-scope.ts";
export { validateInventoryDocumentScope } from "./application/inventory-scope-validation.ts";
export type { InventoryScopeReaders, InventoryScopeContext, ScopedInventoryDocument } from "./application/inventory-scope-validation.ts";
export { reserveInventoryDocumentNumber, INVENTORY_NUMBER_SERIES_TYPES, DEFAULT_INVENTORY_NUMBER_SERIES_DEFINITIONS } from "./application/inventory-numbering.ts";
export type { InventoryNumberReservation } from "./application/inventory-numbering.ts";

export {
  INVENTORY_CORE_STOCK_DOCUMENT_TYPES,
  confirmInventoryReceiptIssueOpening,
  serializeInventoryOpeningBalanceKey,
} from "./application/inventory-core-workflows.ts";
export type {
  ConfirmInventoryCoreDocumentInput,
  InventoryCoreConfirmationResult,
  InventoryCoreStockDocumentType,
  InventoryLineConfirmationResolution,
  InventoryLineMovementIdentity,
  InventoryOpeningBalanceKey,
} from "./application/inventory-core-workflows.ts";
