import type { OrganizedWarehouseSnapshot } from "../../domain/warehouse-organization.ts";
import type { WarehouseExternalIdentifier } from "../../domain/warehouse-identifiers.ts";
import type { WarehouseLocationSnapshot, WarehouseZoneSnapshot } from "../../domain/warehouse-physical-structure.ts";

export interface WarehousePersistenceState {
  readonly warehouse: OrganizedWarehouseSnapshot;
  readonly externalIdentifiers: readonly WarehouseExternalIdentifier[];
  readonly version: number;
}

export interface WarehouseRepository {
  findById(companyId: string, warehouseId: string): Promise<WarehousePersistenceState | null>;
  findByCode(companyId: string, code: string): Promise<WarehousePersistenceState | null>;
  findByExternalIdentifier(
    companyId: string,
    namespace: string,
    value: string,
  ): Promise<WarehousePersistenceState | null>;
  add(state: WarehousePersistenceState): Promise<void>;
  update(state: WarehousePersistenceState, expectedVersion: number): Promise<void>;
}

export interface WarehouseZoneRepository {
  findById(companyId: string, zoneId: string): Promise<WarehouseZoneSnapshot | null>;
  listByWarehouse(companyId: string, warehouseId: string): Promise<readonly WarehouseZoneSnapshot[]>;
  add(zone: WarehouseZoneSnapshot): Promise<void>;
  update(zone: WarehouseZoneSnapshot): Promise<void>;
}

export interface WarehouseLocationRepository {
  findById(companyId: string, locationId: string): Promise<WarehouseLocationSnapshot | null>;
  listByWarehouse(companyId: string, warehouseId: string): Promise<readonly WarehouseLocationSnapshot[]>;
  listByZone(companyId: string, warehouseId: string, zoneId: string): Promise<readonly WarehouseLocationSnapshot[]>;
  add(location: WarehouseLocationSnapshot): Promise<void>;
  update(location: WarehouseLocationSnapshot): Promise<void>;
}
