import type { WarehouseKind } from "../domain/warehouse-lifecycle.ts";
import type { WarehouseLocationKind } from "../domain/warehouse-physical-structure.ts";
import type {
  WarehouseListItemDto,
  WarehouseLocationDto,
  WarehouseZoneDto,
} from "./contracts/warehouse-dto.ts";
import type {
  ListWarehouseLocationsQuery,
  ListWarehouseZonesQuery,
  WarehouseSelectorQuery,
} from "./contracts/warehouse-queries.ts";

export const WAREHOUSE_SELECTOR_CONSUMERS = Object.freeze([
  "inventory",
  "purchases",
  "sales",
  "manufacturing",
  "transfer",
  "adjustment",
] as const);

export type WarehouseSelectorConsumer = (typeof WAREHOUSE_SELECTOR_CONSUMERS)[number];

export interface WarehouseSelectionPolicy {
  readonly consumer: WarehouseSelectorConsumer;
  readonly branchId?: string | null;
  readonly includeCompanyWide?: boolean;
  readonly kinds?: readonly WarehouseKind[];
  readonly limit?: number;
}

export interface WarehouseSelectionReference {
  readonly warehouseId: string;
  readonly code: string;
  readonly title: string;
  readonly kind: WarehouseKind;
  readonly scope: WarehouseListItemDto["organizationalScope"];
}

export interface WarehouseZoneSelectionReference {
  readonly warehouseId: string;
  readonly zoneId: string;
  readonly code: string;
  readonly title: string;
}

export interface WarehouseLocationSelectionReference {
  readonly warehouseId: string;
  readonly zoneId: string;
  readonly locationId: string;
  readonly parentLocationId: string | null;
  readonly code: string;
  readonly title: string;
  readonly kind: WarehouseLocationKind;
}

export type WarehouseSelectionContractErrorCode =
  | "warehouse.selection.company-id.required"
  | "warehouse.selection.branch-id.required"
  | "warehouse.selection.warehouse-id.required"
  | "warehouse.selection.zone-id.required"
  | "warehouse.selection.limit.invalid";

export class WarehouseSelectionContractError extends Error {
  constructor(
    readonly code: WarehouseSelectionContractErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WarehouseSelectionContractError";
  }
}

export function buildWarehouseSelectorQuery(
  companyId: string,
  search: string | null | undefined,
  policy: WarehouseSelectionPolicy,
): WarehouseSelectorQuery {
  const normalizedCompanyId = required(companyId, "warehouse.selection.company-id.required");
  const limit = policy.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new WarehouseSelectionContractError(
      "warehouse.selection.limit.invalid",
      "Warehouse selector limit must be an integer between 1 and 100.",
    );
  }

  const branchId = policy.branchId?.trim() || null;
  const includeCompanyWide = policy.includeCompanyWide ?? true;
  const normalizedSearch = search?.trim();
  const kinds = unique(policy.kinds ?? []);

  return Object.freeze({
    companyId: normalizedCompanyId,
    ...(branchId ? { branchId } : {}),
    ...(normalizedSearch ? { search: normalizedSearch } : {}),
    ...(kinds.length > 0 ? { kinds } : {}),
    statuses: Object.freeze(["active"] as const),
    includeCompanyWide,
    limit,
  });
}

export function buildWarehouseZoneSelectorQuery(
  companyId: string,
  warehouseId: string,
): ListWarehouseZonesQuery {
  return Object.freeze({
    companyId: required(companyId, "warehouse.selection.company-id.required"),
    warehouseId: required(warehouseId, "warehouse.selection.warehouse-id.required"),
    statuses: Object.freeze(["active"] as const),
  });
}

export function buildWarehouseLocationSelectorQuery(input: {
  readonly companyId: string;
  readonly warehouseId: string;
  readonly zoneId?: string | null;
  readonly parentLocationId?: string | null;
  readonly kinds?: readonly WarehouseLocationKind[];
}): ListWarehouseLocationsQuery {
  const companyId = required(input.companyId, "warehouse.selection.company-id.required");
  const warehouseId = required(input.warehouseId, "warehouse.selection.warehouse-id.required");
  const zoneId = input.zoneId?.trim();
  const parentLocationId = input.parentLocationId?.trim();
  const kinds = unique(input.kinds ?? []);
  return Object.freeze({
    companyId,
    warehouseId,
    ...(zoneId ? { zoneId } : {}),
    ...(input.parentLocationId !== undefined
      ? { parentLocationId: parentLocationId || null }
      : {}),
    ...(kinds.length > 0 ? { kinds } : {}),
    statuses: Object.freeze(["active"] as const),
  });
}

export function toWarehouseSelectionReference(
  item: WarehouseListItemDto,
): WarehouseSelectionReference {
  if (item.status !== "active") {
    throw new WarehouseSelectionContractError(
      "warehouse.selection.warehouse-id.required",
      "Only active warehouses can be selected by future consumers.",
    );
  }
  return Object.freeze({
    warehouseId: item.warehouseId,
    code: item.code,
    title: item.title,
    kind: item.kind,
    scope: item.organizationalScope,
  });
}

export function toWarehouseZoneSelectionReference(
  zone: WarehouseZoneDto,
): WarehouseZoneSelectionReference {
  return Object.freeze({
    warehouseId: zone.warehouseId,
    zoneId: zone.zoneId,
    code: zone.code,
    title: zone.title,
  });
}

export function toWarehouseLocationSelectionReference(
  location: WarehouseLocationDto,
): WarehouseLocationSelectionReference {
  return Object.freeze({
    warehouseId: location.warehouseId,
    zoneId: location.zoneId,
    locationId: location.locationId,
    parentLocationId: location.parentLocationId,
    code: location.code,
    title: location.title,
    kind: location.kind,
  });
}

export function isWarehouseVisibleToBranch(
  item: WarehouseListItemDto,
  branchId: string | null | undefined,
  includeCompanyWide = true,
): boolean {
  if (item.status !== "active") return false;
  if (item.organizationalScope.mode === "company") return includeCompanyWide;
  const normalizedBranchId = branchId?.trim();
  return Boolean(normalizedBranchId) && item.organizationalScope.branchId === normalizedBranchId;
}

function required(value: string, code: WarehouseSelectionContractErrorCode): string {
  const normalized = value.trim();
  if (!normalized) throw new WarehouseSelectionContractError(code, `${code} is required.`);
  return normalized;
}

function unique<TValue extends string>(values: readonly TValue[]): readonly TValue[] {
  return Object.freeze([...new Set(values)]);
}
