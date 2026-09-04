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
  createWarehouseLocation,
  createWarehouseZone,
  rehydrateWarehouseLocation,
  rehydrateWarehouseZone,
  warehouseReferenceFrom,
} from "./domain/warehouse-physical-structure.ts";

export type {
  CreateWarehouseLocationInput,
  CreateWarehouseZoneInput,
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
  ChangeWarehouseScopeCommand,
  ChangeWarehouseStatusCommand,
  CreateWarehouseCommand,
  CreateWarehouseLocationCommand,
  CreateWarehouseZoneCommand,
  UpdateWarehouseCommand,
} from "./application/contracts/warehouse-commands.ts";

export type {
  WarehouseDto,
  WarehouseListItemDto,
  WarehouseLocationDto,
  WarehousePageDto,
  WarehouseZoneDto,
} from "./application/contracts/warehouse-dto.ts";

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
