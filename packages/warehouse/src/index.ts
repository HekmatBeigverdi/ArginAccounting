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
