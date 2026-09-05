import type { WarehouseKind, WarehouseStatus } from "../../domain/warehouse-lifecycle.ts";
import type { WarehouseOrganizationalScope } from "../../domain/warehouse-organization.ts";
import type { WarehouseExternalIdentifier } from "../../domain/warehouse-identifiers.ts";
import type { WarehouseLocationKind, WarehousePhysicalStatus } from "../../domain/warehouse-physical-structure.ts";

export interface CreateWarehouseCommand {
  readonly requestId: string;
  readonly warehouseId: string;
  readonly companyId: string;
  readonly code: string;
  readonly title: string;
  readonly description?: string | null;
  readonly kind: WarehouseKind;
  readonly organizationalScope: WarehouseOrganizationalScope;
  readonly externalIdentifiers?: readonly WarehouseExternalIdentifier[];
  readonly occurredAt: string;
}

export interface UpdateWarehouseCommand {
  readonly requestId: string;
  readonly warehouseId: string;
  readonly companyId: string;
  readonly code: string;
  readonly title: string;
  readonly description?: string | null;
  readonly externalIdentifiers?: readonly WarehouseExternalIdentifier[];
  readonly expectedVersion: number;
  readonly occurredAt: string;
}

export interface ChangeWarehouseStatusCommand {
  readonly requestId: string;
  readonly warehouseId: string;
  readonly companyId: string;
  readonly targetStatus: WarehouseStatus;
  readonly expectedVersion: number;
  readonly occurredAt: string;
}

export interface ChangeWarehouseScopeCommand {
  readonly requestId: string;
  readonly warehouseId: string;
  readonly companyId: string;
  readonly organizationalScope: WarehouseOrganizationalScope;
  readonly expectedVersion: number;
  readonly occurredAt: string;
}

export interface DeleteWarehouseCommand {
  readonly requestId: string;
  readonly warehouseId: string;
  readonly companyId: string;
  readonly expectedVersion: number;
  readonly occurredAt: string;
}

export interface CreateWarehouseZoneCommand {
  readonly requestId: string;
  readonly zoneId: string;
  readonly warehouseId: string;
  readonly companyId: string;
  readonly code: string;
  readonly title: string;
  readonly description?: string | null;
  readonly occurredAt: string;
}

export interface UpdateWarehouseZoneCommand {
  readonly requestId: string;
  readonly zoneId: string;
  readonly warehouseId: string;
  readonly companyId: string;
  readonly code: string;
  readonly title: string;
  readonly description?: string | null;
  readonly occurredAt: string;
}

export interface ChangeWarehouseZoneStatusCommand {
  readonly requestId: string;
  readonly zoneId: string;
  readonly warehouseId: string;
  readonly companyId: string;
  readonly targetStatus: WarehousePhysicalStatus;
  readonly occurredAt: string;
}

export interface DeleteWarehouseZoneCommand {
  readonly requestId: string;
  readonly zoneId: string;
  readonly warehouseId: string;
  readonly companyId: string;
  readonly occurredAt: string;
}

export interface CreateWarehouseLocationCommand {
  readonly requestId: string;
  readonly locationId: string;
  readonly zoneId: string;
  readonly warehouseId: string;
  readonly companyId: string;
  readonly code: string;
  readonly title: string;
  readonly kind: WarehouseLocationKind;
  readonly parentLocationId?: string | null;
  readonly description?: string | null;
  readonly occurredAt: string;
}

export interface UpdateWarehouseLocationCommand {
  readonly requestId: string;
  readonly locationId: string;
  readonly companyId: string;
  readonly code: string;
  readonly title: string;
  readonly kind: WarehouseLocationKind;
  readonly description?: string | null;
  readonly occurredAt: string;
}

export interface ChangeWarehouseLocationStatusCommand {
  readonly requestId: string;
  readonly locationId: string;
  readonly companyId: string;
  readonly targetStatus: WarehousePhysicalStatus;
  readonly occurredAt: string;
}

export interface MoveWarehouseLocationCommand {
  readonly requestId: string;
  readonly locationId: string;
  readonly companyId: string;
  readonly targetWarehouseId: string;
  readonly targetZoneId: string;
  readonly parentLocationId?: string | null;
  readonly occurredAt: string;
}

export interface DeleteWarehouseLocationCommand {
  readonly requestId: string;
  readonly locationId: string;
  readonly warehouseId: string;
  readonly companyId: string;
  readonly occurredAt: string;
}
