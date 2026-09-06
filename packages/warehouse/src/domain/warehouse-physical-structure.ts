import {
  WAREHOUSE_DOMAIN_ERROR_CODES,
  WarehouseDomainError,
  type WarehouseSnapshot,
} from "./warehouse.ts";

export type WarehousePhysicalStatus = "active" | "inactive";

export const WAREHOUSE_LOCATION_KINDS = [
  "bin",
  "rack",
  "shelf",
  "staging",
  "receiving",
  "dispatch",
  "other",
] as const;

export type WarehouseLocationKind = (typeof WAREHOUSE_LOCATION_KINDS)[number];

export interface WarehouseReference {
  readonly warehouseId: string;
  readonly companyId: string;
}

export interface WarehouseZoneSnapshot {
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

export interface WarehouseLocationSnapshot {
  readonly locationId: string;
  readonly zoneId: string;
  readonly warehouseId: string;
  readonly companyId: string;
  readonly parentLocationId: string | null;
  readonly code: string;
  readonly title: string;
  readonly kind: WarehouseLocationKind;
  readonly description: string | null;
  readonly status: WarehousePhysicalStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateWarehouseZoneInput {
  readonly zoneId: string;
  readonly warehouse: WarehouseReference;
  readonly code: string;
  readonly title: string;
  readonly description?: string | null;
  readonly createdAt: string;
}

export interface CreateWarehouseLocationInput {
  readonly locationId: string;
  readonly zone: WarehouseZoneSnapshot;
  readonly warehouse: WarehouseReference;
  readonly parentLocationId?: string | null;
  readonly code: string;
  readonly title: string;
  readonly kind: WarehouseLocationKind;
  readonly description?: string | null;
  readonly createdAt: string;
}

export interface UpdateWarehouseZoneInput {
  readonly zone: WarehouseZoneSnapshot;
  readonly code: string;
  readonly title: string;
  readonly description?: string | null;
  readonly occurredAt: string;
}

export interface UpdateWarehouseLocationInput {
  readonly location: WarehouseLocationSnapshot;
  readonly code: string;
  readonly title: string;
  readonly kind: WarehouseLocationKind;
  readonly description?: string | null;
  readonly occurredAt: string;
}

export interface MoveWarehouseLocationInput {
  readonly location: WarehouseLocationSnapshot;
  readonly targetZone: WarehouseZoneSnapshot;
  readonly targetWarehouse: WarehouseReference;
  readonly parentLocationId?: string | null;
  readonly occurredAt: string;
}

const normalizeRequired = (value: string, errorCode: keyof typeof WAREHOUSE_DOMAIN_ERROR_CODES): string => {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (normalized.length === 0) {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES[errorCode]);
  }
  return normalized;
};

const normalizeOptional = (value: string | null | undefined): string | null => {
  if (value == null) return null;
  const normalized = value.trim().replace(/\s+/gu, " ");
  return normalized.length === 0 ? null : normalized;
};

const normalizeCode = (value: string): string =>
  normalizeRequired(value, "codeRequired").toUpperCase();

const normalizeTimestamp = (value: string, errorCode: "createdAtInvalid" | "updatedAtInvalid"): string => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES[errorCode]);
  }
  return new Date(parsed).toISOString();
};

const assertTimestampOrder = (createdAt: string, updatedAt: string): void => {
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES.timestampOrderInvalid);
  }
};

const mutationTimestamp = (currentUpdatedAt: string, occurredAt: string): string => {
  const normalized = normalizeTimestamp(occurredAt, "updatedAtInvalid");
  if (Date.parse(normalized) < Date.parse(currentUpdatedAt)) {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES.physicalTimestampRegression);
  }
  return normalized;
};

const assertPhysicalStatus: (status: string) => asserts status is WarehousePhysicalStatus = (status) => {
  if (status !== "active" && status !== "inactive") {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES.physicalStatusInvalid);
  }
};

const assertLocationKind: (kind: string) => asserts kind is WarehouseLocationKind = (kind) => {
  if (!(WAREHOUSE_LOCATION_KINDS as readonly string[]).includes(kind)) {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES.locationKindInvalid);
  }
};

const normalizeWarehouseReference = (warehouse: WarehouseReference): WarehouseReference => ({
  warehouseId: normalizeRequired(warehouse.warehouseId, "warehouseReferenceRequired"),
  companyId: normalizeRequired(warehouse.companyId, "companyIdRequired"),
});

export const warehouseReferenceFrom = (warehouse: WarehouseSnapshot): WarehouseReference =>
  Object.freeze({ warehouseId: warehouse.warehouseId, companyId: warehouse.companyId });

export const createWarehouseZone = (input: CreateWarehouseZoneInput): WarehouseZoneSnapshot => {
  const warehouse = normalizeWarehouseReference(input.warehouse);
  const createdAt = normalizeTimestamp(input.createdAt, "createdAtInvalid");
  return Object.freeze({
    zoneId: normalizeRequired(input.zoneId, "zoneIdRequired"),
    warehouseId: warehouse.warehouseId,
    companyId: warehouse.companyId,
    code: normalizeCode(input.code),
    title: normalizeRequired(input.title, "titleRequired"),
    description: normalizeOptional(input.description),
    status: "active" as const,
    createdAt,
    updatedAt: createdAt,
  });
};

export const rehydrateWarehouseZone = (snapshot: WarehouseZoneSnapshot): WarehouseZoneSnapshot => {
  assertPhysicalStatus(snapshot.status);
  const createdAt = normalizeTimestamp(snapshot.createdAt, "createdAtInvalid");
  const updatedAt = normalizeTimestamp(snapshot.updatedAt, "updatedAtInvalid");
  assertTimestampOrder(createdAt, updatedAt);
  return Object.freeze({
    zoneId: normalizeRequired(snapshot.zoneId, "zoneIdRequired"),
    warehouseId: normalizeRequired(snapshot.warehouseId, "warehouseReferenceRequired"),
    companyId: normalizeRequired(snapshot.companyId, "companyIdRequired"),
    code: normalizeCode(snapshot.code),
    title: normalizeRequired(snapshot.title, "titleRequired"),
    description: normalizeOptional(snapshot.description),
    status: snapshot.status,
    createdAt,
    updatedAt,
  });
};

export const updateWarehouseZone = (input: UpdateWarehouseZoneInput): WarehouseZoneSnapshot => {
  const current = rehydrateWarehouseZone(input.zone);
  return Object.freeze({
    ...current,
    code: normalizeCode(input.code),
    title: normalizeRequired(input.title, "titleRequired"),
    description: normalizeOptional(input.description),
    updatedAt: mutationTimestamp(current.updatedAt, input.occurredAt),
  });
};

export const setWarehouseZoneStatus = (
  zone: WarehouseZoneSnapshot,
  status: WarehousePhysicalStatus,
  occurredAt: string,
): WarehouseZoneSnapshot => {
  const current = rehydrateWarehouseZone(zone);
  assertPhysicalStatus(status);
  if (current.status === status) return current;
  return Object.freeze({ ...current, status, updatedAt: mutationTimestamp(current.updatedAt, occurredAt) });
};

export const createWarehouseLocation = (input: CreateWarehouseLocationInput): WarehouseLocationSnapshot => {
  const warehouse = normalizeWarehouseReference(input.warehouse);
  const zone = rehydrateWarehouseZone(input.zone);
  if (zone.companyId !== warehouse.companyId) {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES.physicalCompanyMismatch);
  }
  if (zone.warehouseId !== warehouse.warehouseId) {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES.physicalWarehouseMismatch);
  }
  assertLocationKind(input.kind);
  const locationId = normalizeRequired(input.locationId, "locationIdRequired");
  const parentLocationId = normalizeOptional(input.parentLocationId);
  if (parentLocationId === locationId) {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES.parentLocationSelfReference);
  }
  const createdAt = normalizeTimestamp(input.createdAt, "createdAtInvalid");
  return Object.freeze({
    locationId,
    zoneId: zone.zoneId,
    warehouseId: warehouse.warehouseId,
    companyId: warehouse.companyId,
    parentLocationId,
    code: normalizeCode(input.code),
    title: normalizeRequired(input.title, "titleRequired"),
    kind: input.kind,
    description: normalizeOptional(input.description),
    status: "active" as const,
    createdAt,
    updatedAt: createdAt,
  });
};

export const rehydrateWarehouseLocation = (
  snapshot: WarehouseLocationSnapshot,
  zone: WarehouseZoneSnapshot,
): WarehouseLocationSnapshot => {
  const canonicalZone = rehydrateWarehouseZone(zone);
  assertPhysicalStatus(snapshot.status);
  assertLocationKind(snapshot.kind);
  const locationId = normalizeRequired(snapshot.locationId, "locationIdRequired");
  const zoneId = normalizeRequired(snapshot.zoneId, "zoneReferenceRequired");
  if (zoneId !== canonicalZone.zoneId) {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES.zoneReferenceMismatch);
  }
  if (snapshot.companyId !== canonicalZone.companyId) {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES.physicalCompanyMismatch);
  }
  if (snapshot.warehouseId !== canonicalZone.warehouseId) {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES.physicalWarehouseMismatch);
  }
  const parentLocationId = normalizeOptional(snapshot.parentLocationId);
  if (parentLocationId === locationId) {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES.parentLocationSelfReference);
  }
  const createdAt = normalizeTimestamp(snapshot.createdAt, "createdAtInvalid");
  const updatedAt = normalizeTimestamp(snapshot.updatedAt, "updatedAtInvalid");
  assertTimestampOrder(createdAt, updatedAt);
  return Object.freeze({
    locationId,
    zoneId,
    warehouseId: normalizeRequired(snapshot.warehouseId, "warehouseReferenceRequired"),
    companyId: normalizeRequired(snapshot.companyId, "companyIdRequired"),
    parentLocationId,
    code: normalizeCode(snapshot.code),
    title: normalizeRequired(snapshot.title, "titleRequired"),
    kind: snapshot.kind,
    description: normalizeOptional(snapshot.description),
    status: snapshot.status,
    createdAt,
    updatedAt,
  });
};

export const updateWarehouseLocation = (input: UpdateWarehouseLocationInput): WarehouseLocationSnapshot => {
  assertLocationKind(input.kind);
  return Object.freeze({
    ...input.location,
    code: normalizeCode(input.code),
    title: normalizeRequired(input.title, "titleRequired"),
    kind: input.kind,
    description: normalizeOptional(input.description),
    updatedAt: mutationTimestamp(input.location.updatedAt, input.occurredAt),
  });
};

export const setWarehouseLocationStatus = (
  location: WarehouseLocationSnapshot,
  status: WarehousePhysicalStatus,
  occurredAt: string,
): WarehouseLocationSnapshot => {
  assertPhysicalStatus(status);
  if (location.status === status) return location;
  return Object.freeze({ ...location, status, updatedAt: mutationTimestamp(location.updatedAt, occurredAt) });
};

export const moveWarehouseLocation = (input: MoveWarehouseLocationInput): WarehouseLocationSnapshot => {
  const targetWarehouse = normalizeWarehouseReference(input.targetWarehouse);
  const targetZone = rehydrateWarehouseZone(input.targetZone);
  if (targetZone.companyId !== targetWarehouse.companyId) {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES.physicalCompanyMismatch);
  }
  if (targetZone.warehouseId !== targetWarehouse.warehouseId) {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES.physicalWarehouseMismatch);
  }
  if (input.location.companyId !== targetWarehouse.companyId) {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES.physicalCompanyMismatch);
  }
  const parentLocationId = normalizeOptional(input.parentLocationId);
  if (parentLocationId === input.location.locationId) {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES.parentLocationSelfReference);
  }
  return Object.freeze({
    ...input.location,
    warehouseId: targetWarehouse.warehouseId,
    zoneId: targetZone.zoneId,
    parentLocationId,
    updatedAt: mutationTimestamp(input.location.updatedAt, input.occurredAt),
  });
};

export const assertLocationParentAcyclic = (
  locationId: string,
  parentLocationId: string | null,
  parentById: ReadonlyMap<string, string | null>,
): void => {
  let cursor = parentLocationId;
  const visited = new Set<string>([locationId]);
  while (cursor) {
    if (visited.has(cursor)) {
      throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES.parentLocationCycle);
    }
    visited.add(cursor);
    cursor = parentById.get(cursor) ?? null;
  }
};
