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

export {
  confirmInventoryQuantityAdjustment,
  confirmInventoryTransfer,
  reverseInventoryStockEffects,
} from "./application/inventory-transfer-adjustment-workflows.ts";
export type {
  ConfirmInventoryAdjustmentInput,
  ConfirmInventoryTransferInput,
  InventoryReversalMovementIdentity,
  InventoryStockWorkflowResult,
  InventoryTransferLineMovementIdentity,
  InventoryTransferLineResolution,
  ReverseInventoryStockEffectsInput,
} from "./application/inventory-transfer-adjustment-workflows.ts";

export { InventoryApplicationService } from "./application/inventory-application-service.ts";
export type {
  InventoryApplicationIdentityFactory,
  InventoryApplicationMutationResult,
  InventoryApplicationServiceDependencies,
  InventoryCurrentMasterResolver,
  InventoryNumberingGateway,
} from "./application/inventory-application-service.ts";

export { InventoryDraftService } from "./application/inventory-draft-service.ts";
export type { InventoryDraftMutationResult } from "./application/inventory-draft-service.ts";

export { SecuredInventoryService } from "./application/secured-inventory-service.ts";
export type { SecuredInventoryServiceDependencies } from "./application/secured-inventory-service.ts";
export { SecuredInventoryQuantityConfirmationPort } from "./application/inventory-erp-integration.ts";
export type { InventoryErpConfirmationAdapterDependencies } from "./application/inventory-erp-integration.ts";

export {
  INVENTORY_APPLICATION_ERROR_CODES,
  InventoryApplicationError,
} from "./application/contracts/inventory-errors.ts";
export type { InventoryApplicationErrorCode } from "./application/contracts/inventory-errors.ts";

export {
  INVENTORY_APPROVAL_REQUEST_TYPE,
  inventoryCorrelationId,
  inventoryPermissions,
} from "./application/contracts/inventory-security.ts";
export type {
  InventoryApprovalGateway,
  InventoryApprovalReference,
  InventoryAuditAction,
  InventoryAuditEvent,
  InventoryAuditSink,
  InventoryAuthorizationContext,
  InventoryAuthorizationPolicy,
  InventoryPermission,
  InventorySecurityContext,
} from "./application/contracts/inventory-security.ts";

export {
  INVENTORY_QUERY_LIMITS,
  normalizeInventoryCursorRequest,
  normalizeInventoryPageRequest,
} from "./application/contracts/inventory-queries.ts";
export type {
  GetInventoryDocumentByNumberQuery,
  GetInventoryDocumentQuery,
  InventoryBalanceQuery,
  InventoryCursorRequest,
  InventoryDocumentFilter,
  InventoryDocumentSort,
  InventoryDocumentSortField,
  InventoryKardexQuery,
  InventoryPageRequest,
  InventorySortDirection,
  ListInventoryDocumentsQuery,
} from "./application/contracts/inventory-queries.ts";

export { inventoryBalanceRowFromSnapshot } from "./application/contracts/inventory-dto.ts";
export type {
  InventoryBalanceRow,
  InventoryCursorPage,
  InventoryDocumentDetail,
  InventoryDocumentListItem,
  InventoryKardexEntry,
  InventoryPage,
} from "./application/contracts/inventory-dto.ts";

export type { InventoryQueryReader } from "./application/contracts/inventory-reader.ts";
export type {
  InventoryKardexCursorPayload,
  InventoryKardexReport,
  InventoryKardexReportEntry,
  InventoryKardexReportQuery,
  InventoryKardexSourceReference,
  InventoryQuantityBalanceReport,
  InventoryQuantityBalanceReportQuery,
  InventoryQuantityBalanceReportRow,
  InventoryQuantityReportReader,
} from "./application/contracts/inventory-reporting.ts";
export type {
  ConfirmInventoryDocumentCommand,
  CreateInventoryDocumentCommand,
  DeleteInventoryDraftCommand,
  InventoryCommandMetadata,
  InventoryLifecycleCommand,
  ReverseInventoryCommand,
  SaveInventoryDraftCommand,
} from "./application/contracts/inventory-commands.ts";
export type {
  InventoryBalanceProjectionRepository,
  InventoryBusinessOrderRepository,
  InventoryDocumentRepository,
  InventoryIdempotencyOutcomeKind,
  InventoryIdempotencyRecord,
  InventoryIdempotencyRepository,
  InventoryMovementRepository,
  InventoryOpeningBalanceRepository,
} from "./application/contracts/inventory-repository.ts";
export type {
  InventoryUnitOfWork,
  InventoryUnitOfWorkContext,
} from "./application/contracts/inventory-unit-of-work.ts";
export type {
  ConfirmInventorySourceDocumentRequest,
  InventoryMovementFeedEntry,
  InventoryMovementFeedPage,
  InventoryMovementFeedReader,
  InventoryMovementFeedRequest,
  InventoryQuantityConfirmationPort,
  InventorySourceDocumentPort,
  InventorySourceDocumentResult,
  InventorySourceQuantityDocumentType,
  InventorySourceQuantityLine,
  StageInventorySourceDocumentRequest,
} from "./application/contracts/inventory-consumer.ts";

export {
  INVENTORY_MOVEMENT_BATCH_KINDS,
  INVENTORY_SYNC_CHANGE_KINDS,
  INVENTORY_SYNC_CONTRACT_VERSION,
  InventorySyncContractError,
  createInventoryDocumentSyncTombstoneEnvelope,
  createInventoryDocumentSyncUpsertEnvelope,
  createInventoryMovementBatchSyncEnvelope,
} from "./application/contracts/inventory-sync.ts";
export type {
  CreateInventoryDocumentSyncTombstoneInput,
  CreateInventoryDocumentSyncUpsertInput,
  CreateInventoryMovementBatchSyncInput,
  InventoryDocumentSyncEnvelope,
  InventoryDocumentSyncTombstoneEnvelope,
  InventoryDocumentSyncUpsertEnvelope,
  InventoryMovementBatchKind,
  InventoryMovementBatchSyncEnvelope,
  InventorySyncChangeKind,
  InventorySyncContractErrorCode,
  InventorySyncDependency,
  InventorySyncDocumentReference,
  InventorySyncExternalReference,
  InventorySyncOrigin,
} from "./application/contracts/inventory-sync.ts";
