export {
  WAREHOUSE_DOMAIN_ERROR_CODES,
  WarehouseDomainError,
  createWarehouse,
  rehydrateWarehouse,
} from "./domain/warehouse.ts";

export type {
  CreateWarehouseInput,
  WarehouseDomainErrorCode,
  WarehouseSnapshot,
} from "./domain/warehouse.ts";

export {
  WAREHOUSE_KINDS,
  activateWarehouse,
  archiveWarehouse,
  classifyWarehouse,
  deactivateWarehouse,
  rehydrateClassifiedWarehouse,
} from "./domain/warehouse-lifecycle.ts";

export type {
  ClassifiedWarehouseSnapshot,
  ClassifyWarehouseInput,
  WarehouseKind,
  WarehouseStatus,
} from "./domain/warehouse-lifecycle.ts";

export {
  assignWarehouseOrganizationalScope,
  changeWarehouseOrganizationalScope,
  rehydrateOrganizedWarehouse,
} from "./domain/warehouse-organization.ts";

export type {
  AssignWarehouseOrganizationalScopeInput,
  ChangeWarehouseOrganizationalScopeInput,
  OrganizedWarehouseSnapshot,
  WarehouseBranchReference,
  WarehouseOrganizationalScope,
} from "./domain/warehouse-organization.ts";

export {
  WAREHOUSE_LOCATION_KINDS,
  assertLocationParentAcyclic,
  createWarehouseLocation,
  createWarehouseZone,
  moveWarehouseLocation,
  rehydrateWarehouseLocation,
  rehydrateWarehouseZone,
  setWarehouseLocationStatus,
  setWarehouseZoneStatus,
  updateWarehouseLocation,
  updateWarehouseZone,
  warehouseReferenceFrom,
} from "./domain/warehouse-physical-structure.ts";

export type {
  CreateWarehouseLocationInput,
  CreateWarehouseZoneInput,
  MoveWarehouseLocationInput,
  UpdateWarehouseLocationInput,
  UpdateWarehouseZoneInput,
  WarehouseLocationKind,
  WarehouseLocationSnapshot,
  WarehousePhysicalStatus,
  WarehouseReference,
  WarehouseZoneSnapshot,
} from "./domain/warehouse-physical-structure.ts";

export {
  assertWarehouseIdentifiersUnique,
  createWarehouseIdentifierSnapshot,
  normalizeWarehouseCode,
  normalizeWarehouseExternalIdentifier,
} from "./domain/warehouse-identifiers.ts";

export type {
  WarehouseDuplicateCandidate,
  WarehouseExternalIdentifier,
  WarehouseIdentifierSnapshot,
} from "./domain/warehouse-identifiers.ts";

export type {
  ChangeWarehouseLocationStatusCommand,
  ChangeWarehouseScopeCommand,
  ChangeWarehouseStatusCommand,
  ChangeWarehouseZoneStatusCommand,
  CreateWarehouseCommand,
  CreateWarehouseLocationCommand,
  CreateWarehouseZoneCommand,
  DeleteWarehouseCommand,
  DeleteWarehouseLocationCommand,
  DeleteWarehouseZoneCommand,
  MoveWarehouseLocationCommand,
  UpdateWarehouseCommand,
  UpdateWarehouseLocationCommand,
  UpdateWarehouseZoneCommand,
} from "./application/contracts/warehouse-commands.ts";

export type {
  WarehouseDto,
  WarehouseListItemDto,
  WarehouseLocationDto,
  WarehousePageDto,
  WarehouseZoneDto,
} from "./application/contracts/warehouse-dto.ts";

export {
  allowUnintegratedWarehouseDependencies,
} from "./application/contracts/warehouse-dependencies.ts";
export type {
  WarehouseDependencyBlocker,
  WarehouseDependencyCheck,
  WarehouseDependencyGuard,
  WarehouseDependencyKind,
  WarehouseProtectedOperation,
} from "./application/contracts/warehouse-dependencies.ts";

export {
  WAREHOUSE_APPLICATION_ERROR_CODES,
  WarehouseApplicationError,
} from "./application/contracts/warehouse-errors.ts";
export type { WarehouseApplicationErrorCode } from "./application/contracts/warehouse-errors.ts";

export { WAREHOUSE_QUERY_LIMITS } from "./application/contracts/warehouse-queries.ts";

export type {
  GetWarehouseByCodeQuery,
  GetWarehouseByIdQuery,
  ListWarehouseLocationsQuery,
  ListWarehousesQuery,
  ListWarehouseZonesQuery,
  WarehouseFilter,
  WarehousePageRequest,
  WarehouseSelectorQuery,
  WarehouseSort,
  WarehouseSortDirection,
  WarehouseSortField,
} from "./application/contracts/warehouse-queries.ts";

export type {
  WarehouseLocationRepository,
  WarehousePersistenceState,
  WarehouseRepository,
  WarehouseZoneRepository,
} from "./application/contracts/warehouse-repository.ts";

export type { WarehouseReader } from "./application/contracts/warehouse-reader.ts";
export type {
  WarehouseUnitOfWork,
  WarehouseUnitOfWorkContext,
} from "./application/contracts/warehouse-unit-of-work.ts";
export type {
  WarehouseBranchResolver,
  WarehouseIdempotencyExecutor,
} from "./application/contracts/warehouse-validation.ts";

export {
  warehouseApprovalIntegration,
  warehouseCorrelationId,
  warehousePermissions,
} from "./application/contracts/warehouse-security.ts";
export type {
  WarehouseAuditAction,
  WarehouseAuditEvent,
  WarehouseAuditSink,
  WarehouseAuthorizationContext,
  WarehouseAuthorizationPolicy,
  WarehouseMutationCommand,
  WarehousePermission,
  WarehouseReadSecurityContext,
  WarehouseSecurityContext,
} from "./application/contracts/warehouse-security.ts";

export {
  createWarehousePhysicalTombstoneEnvelope,
  createWarehousePhysicalUpsertEnvelope,
} from "./application/contracts/warehouse-physical-sync.ts";
export type {
  WarehousePhysicalSyncChangeKind,
  WarehousePhysicalSyncEntityReference,
  WarehousePhysicalSyncEntityType,
  WarehousePhysicalSyncEnvelope,
  WarehousePhysicalSyncEnvelopeBase,
  WarehousePhysicalSyncOrigin,
  WarehousePhysicalSyncTombstoneEnvelope,
  WarehousePhysicalSyncUpsertEnvelope,
} from "./application/contracts/warehouse-physical-sync.ts";

export {
  WAREHOUSE_SYNC_CHANGE_KINDS,
  WarehouseSyncContractError,
  createWarehouseSyncTombstoneEnvelope,
  createWarehouseSyncUpsertEnvelope,
} from "./application/contracts/warehouse-sync.ts";
export type {
  CreateWarehouseSyncTombstoneInput,
  CreateWarehouseSyncUpsertInput,
  WarehouseSyncChangeEnvelope,
  WarehouseSyncChangeKind,
  WarehouseSyncContractErrorCode,
  WarehouseSyncEntityReference,
  WarehouseSyncExternalReference,
  WarehouseSyncOrigin,
  WarehouseSyncSnapshot,
  WarehouseSyncTombstoneEnvelope,
  WarehouseSyncUpsertEnvelope,
} from "./application/contracts/warehouse-sync.ts";

export { WarehouseService } from "./application/warehouse-service.ts";
export type { WarehouseServiceDependencies } from "./application/warehouse-service.ts";
export {
  SecuredWarehouseReader,
  SecuredWarehouseService,
} from "./application/secured-warehouse-service.ts";
export {
  WarehouseBulkTransferService,
  WarehouseInitialSetupService,
  defaultInitialWarehouse,
  warehouseImportFields,
} from "./application/warehouse-bulk-transfer.ts";
export type {
  WarehouseBulkContext,
  WarehouseBulkExportReader,
  WarehouseExportBatchSink,
  WarehouseExportRow,
  WarehouseImportColumnMap,
  WarehouseImportField,
  WarehouseImportIdGenerator,
  WarehouseImportIssue,
  WarehouseImportPreview,
  WarehouseImportPreviewRow,
  WarehouseImportResult,
  WarehouseTabularRow,
} from "./application/warehouse-bulk-transfer.ts";
export { WarehouseReaderBulkExportAdapter } from "./application/warehouse-bulk-export-reader.ts";
