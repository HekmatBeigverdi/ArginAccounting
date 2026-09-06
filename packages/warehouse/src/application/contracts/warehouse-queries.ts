import type { WarehouseKind, WarehouseStatus } from "../../domain/warehouse-lifecycle.ts";
import type { WarehouseLocationKind, WarehousePhysicalStatus } from "../../domain/warehouse-physical-structure.ts";

export const WAREHOUSE_QUERY_LIMITS = Object.freeze({
  minPageSize: 1,
  maxPageSize: 200,
  defaultPageSize: 50,
  minSelectorLimit: 1,
  maxSelectorLimit: 100,
  defaultSelectorLimit: 20,
});

export type WarehouseSortField = "code" | "title" | "kind" | "status" | "createdAt" | "updatedAt";
export type WarehouseSortDirection = "asc" | "desc";

export interface WarehousePageRequest {
  readonly page: number;
  readonly pageSize: number;
}

export interface WarehouseSort {
  readonly field: WarehouseSortField;
  readonly direction: WarehouseSortDirection;
}

export interface WarehouseFilter {
  readonly companyId: string;
  readonly search?: string | null;
  readonly kinds?: readonly WarehouseKind[];
  readonly statuses?: readonly WarehouseStatus[];
  readonly branchId?: string | null;
  readonly includeCompanyWide?: boolean;
  readonly companyWideOnly?: boolean;
  readonly externalIdentifierNamespace?: string | null;
  readonly externalIdentifierValue?: string | null;
}

export interface ListWarehousesQuery {
  readonly filter: WarehouseFilter;
  readonly page: WarehousePageRequest;
  readonly sort?: WarehouseSort;
}

export interface GetWarehouseByIdQuery {
  readonly companyId: string;
  readonly warehouseId: string;
}

export interface GetWarehouseByCodeQuery {
  readonly companyId: string;
  readonly code: string;
}

export interface WarehouseSelectorQuery {
  readonly companyId: string;
  readonly branchId?: string | null;
  readonly search?: string | null;
  readonly kinds?: readonly WarehouseKind[];
  readonly statuses?: readonly WarehouseStatus[];
  readonly includeCompanyWide?: boolean;
  readonly companyWideOnly?: boolean;
  readonly limit: number;
}

export interface ListWarehouseZonesQuery {
  readonly companyId: string;
  readonly warehouseId: string;
  readonly statuses?: readonly WarehousePhysicalStatus[];
}

export interface ListWarehouseLocationsQuery {
  readonly companyId: string;
  readonly warehouseId: string;
  readonly zoneId?: string | null;
  readonly parentLocationId?: string | null;
  readonly kinds?: readonly WarehouseLocationKind[];
  readonly statuses?: readonly WarehousePhysicalStatus[];
}
