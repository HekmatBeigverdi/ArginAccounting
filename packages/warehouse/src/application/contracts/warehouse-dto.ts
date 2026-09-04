import type { WarehouseKind, WarehouseStatus } from "../../domain/warehouse-lifecycle.ts";
import type { WarehouseOrganizationalScope } from "../../domain/warehouse-organization.ts";
import type { WarehouseExternalIdentifier } from "../../domain/warehouse-identifiers.ts";
import type { WarehouseLocationKind, WarehousePhysicalStatus } from "../../domain/warehouse-physical-structure.ts";

export interface WarehouseDto {
  readonly warehouseId: string;
  readonly companyId: string;
  readonly code: string;
  readonly title: string;
  readonly description: string | null;
  readonly kind: WarehouseKind;
  readonly status: WarehouseStatus;
  readonly organizationalScope: WarehouseOrganizationalScope;
  readonly externalIdentifiers: readonly WarehouseExternalIdentifier[];
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WarehouseListItemDto {
  readonly warehouseId: string;
  readonly code: string;
  readonly title: string;
  readonly kind: WarehouseKind;
  readonly status: WarehouseStatus;
  readonly organizationalScope: WarehouseOrganizationalScope;
  readonly version: number;
}

export interface WarehouseZoneDto {
  readonly zoneId: string;
  readonly warehouseId: string;
  readonly companyId: string;
  readonly code: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: WarehousePhysicalStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WarehouseLocationDto {
  readonly locationId: string;
  readonly zoneId: string;
  readonly warehouseId: string;
  readonly companyId: string;
  readonly code: string;
  readonly title: string;
  readonly description: string | null;
  readonly kind: WarehouseLocationKind;
  readonly parentLocationId: string | null;
  readonly status: WarehousePhysicalStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WarehousePageDto<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
}
