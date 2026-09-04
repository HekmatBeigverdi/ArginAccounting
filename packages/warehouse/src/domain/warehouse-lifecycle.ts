import {
  WAREHOUSE_DOMAIN_ERROR_CODES,
  WarehouseDomainError,
  type WarehouseSnapshot,
} from "./warehouse.ts";

export const WAREHOUSE_KINDS = [
  "general",
  "raw-material",
  "finished-goods",
  "consumables",
  "spare-parts",
  "wip",
  "transit",
  "consignment",
  "other",
] as const;

export type WarehouseKind = (typeof WAREHOUSE_KINDS)[number];
export type WarehouseStatus = "active" | "inactive" | "archived";

export interface ClassifiedWarehouseSnapshot extends WarehouseSnapshot {
  readonly kind: WarehouseKind;
  readonly status: WarehouseStatus;
}

export interface ClassifyWarehouseInput {
  readonly warehouse: WarehouseSnapshot;
  readonly kind: WarehouseKind;
}

const isWarehouseKind = (value: string): value is WarehouseKind =>
  (WAREHOUSE_KINDS as readonly string[]).includes(value);

function assertWarehouseKind(value: string): asserts value is WarehouseKind {
  if (!isWarehouseKind(value)) {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES.kindInvalid);
  }
}

function assertWarehouseStatus(value: string): asserts value is WarehouseStatus {
  if (value !== "active" && value !== "inactive" && value !== "archived") {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES.statusInvalid);
  }
}

const normalizeOccurredAt = (value: string): string => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES.updatedAtInvalid);
  }
  return new Date(timestamp).toISOString();
};

const assertForwardTimestamp = (
  currentUpdatedAt: string,
  occurredAt: string,
): string => {
  const normalized = normalizeOccurredAt(occurredAt);
  if (Date.parse(normalized) < Date.parse(currentUpdatedAt)) {
    throw new WarehouseDomainError(
      WAREHOUSE_DOMAIN_ERROR_CODES.timestampOrderInvalid,
    );
  }
  return normalized;
};

const freezeClassified = (
  snapshot: ClassifiedWarehouseSnapshot,
): ClassifiedWarehouseSnapshot => Object.freeze({ ...snapshot });

export const classifyWarehouse = (
  input: ClassifyWarehouseInput,
): ClassifiedWarehouseSnapshot => {
  assertWarehouseKind(input.kind);
  return freezeClassified({
    ...input.warehouse,
    kind: input.kind,
    status: "active",
  });
};

export const rehydrateClassifiedWarehouse = (
  snapshot: ClassifiedWarehouseSnapshot,
): ClassifiedWarehouseSnapshot => {
  assertWarehouseKind(snapshot.kind);
  assertWarehouseStatus(snapshot.status);
  return freezeClassified({ ...snapshot });
};

export const deactivateWarehouse = (
  warehouse: ClassifiedWarehouseSnapshot,
  occurredAt: string,
): ClassifiedWarehouseSnapshot => {
  if (warehouse.status === "archived") {
    throw new WarehouseDomainError(
      WAREHOUSE_DOMAIN_ERROR_CODES.archivedTransitionForbidden,
    );
  }
  if (warehouse.status === "inactive") {
    return warehouse;
  }
  return freezeClassified({
    ...warehouse,
    status: "inactive",
    updatedAt: assertForwardTimestamp(warehouse.updatedAt, occurredAt),
  });
};

export const activateWarehouse = (
  warehouse: ClassifiedWarehouseSnapshot,
  occurredAt: string,
): ClassifiedWarehouseSnapshot => {
  if (warehouse.status === "archived") {
    throw new WarehouseDomainError(
      WAREHOUSE_DOMAIN_ERROR_CODES.archivedTransitionForbidden,
    );
  }
  if (warehouse.status === "active") {
    return warehouse;
  }
  return freezeClassified({
    ...warehouse,
    status: "active",
    updatedAt: assertForwardTimestamp(warehouse.updatedAt, occurredAt),
  });
};

export const archiveWarehouse = (
  warehouse: ClassifiedWarehouseSnapshot,
  occurredAt: string,
): ClassifiedWarehouseSnapshot => {
  if (warehouse.status === "archived") {
    return warehouse;
  }
  return freezeClassified({
    ...warehouse,
    status: "archived",
    updatedAt: assertForwardTimestamp(warehouse.updatedAt, occurredAt),
  });
};
