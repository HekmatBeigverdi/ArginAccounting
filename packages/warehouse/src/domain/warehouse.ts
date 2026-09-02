export const WAREHOUSE_DOMAIN_ERROR_CODES = {
  idRequired: "warehouse.id.required",
  companyIdRequired: "warehouse.company-id.required",
  codeRequired: "warehouse.code.required",
  titleRequired: "warehouse.title.required",
  createdAtInvalid: "warehouse.created-at.invalid",
  updatedAtInvalid: "warehouse.updated-at.invalid",
  timestampOrderInvalid: "warehouse.timestamp-order.invalid",
} as const;

export type WarehouseDomainErrorCode =
  (typeof WAREHOUSE_DOMAIN_ERROR_CODES)[keyof typeof WAREHOUSE_DOMAIN_ERROR_CODES];

export class WarehouseDomainError extends Error {
  constructor(public readonly code: WarehouseDomainErrorCode) {
    super(code);
    this.name = "WarehouseDomainError";
  }
}

export interface WarehouseSnapshot {
  readonly warehouseId: string;
  readonly companyId: string;
  readonly code: string;
  readonly title: string;
  readonly description: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateWarehouseInput {
  readonly warehouseId: string;
  readonly companyId: string;
  readonly code: string;
  readonly title: string;
  readonly description?: string | null;
  readonly createdAt: string;
}

const normalizeRequired = (
  value: string,
  errorCode: WarehouseDomainErrorCode,
): string => {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (normalized.length === 0) {
    throw new WarehouseDomainError(errorCode);
  }
  return normalized;
};

const normalizeCode = (value: string): string =>
  normalizeRequired(value, WAREHOUSE_DOMAIN_ERROR_CODES.codeRequired).toUpperCase();

const normalizeOptionalText = (value: string | null | undefined): string | null => {
  if (value == null) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/gu, " ");
  return normalized.length === 0 ? null : normalized;
};

const normalizeTimestamp = (
  value: string,
  errorCode: WarehouseDomainErrorCode,
): string => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new WarehouseDomainError(errorCode);
  }
  return new Date(timestamp).toISOString();
};

const freezeSnapshot = (snapshot: WarehouseSnapshot): WarehouseSnapshot =>
  Object.freeze({ ...snapshot });

export const createWarehouse = (input: CreateWarehouseInput): WarehouseSnapshot => {
  const createdAt = normalizeTimestamp(
    input.createdAt,
    WAREHOUSE_DOMAIN_ERROR_CODES.createdAtInvalid,
  );

  return freezeSnapshot({
    warehouseId: normalizeRequired(
      input.warehouseId,
      WAREHOUSE_DOMAIN_ERROR_CODES.idRequired,
    ),
    companyId: normalizeRequired(
      input.companyId,
      WAREHOUSE_DOMAIN_ERROR_CODES.companyIdRequired,
    ),
    code: normalizeCode(input.code),
    title: normalizeRequired(input.title, WAREHOUSE_DOMAIN_ERROR_CODES.titleRequired),
    description: normalizeOptionalText(input.description),
    createdAt,
    updatedAt: createdAt,
  });
};

export const rehydrateWarehouse = (
  snapshot: WarehouseSnapshot,
): WarehouseSnapshot => {
  const createdAt = normalizeTimestamp(
    snapshot.createdAt,
    WAREHOUSE_DOMAIN_ERROR_CODES.createdAtInvalid,
  );
  const updatedAt = normalizeTimestamp(
    snapshot.updatedAt,
    WAREHOUSE_DOMAIN_ERROR_CODES.updatedAtInvalid,
  );

  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new WarehouseDomainError(
      WAREHOUSE_DOMAIN_ERROR_CODES.timestampOrderInvalid,
    );
  }

  return freezeSnapshot({
    warehouseId: normalizeRequired(
      snapshot.warehouseId,
      WAREHOUSE_DOMAIN_ERROR_CODES.idRequired,
    ),
    companyId: normalizeRequired(
      snapshot.companyId,
      WAREHOUSE_DOMAIN_ERROR_CODES.companyIdRequired,
    ),
    code: normalizeCode(snapshot.code),
    title: normalizeRequired(
      snapshot.title,
      WAREHOUSE_DOMAIN_ERROR_CODES.titleRequired,
    ),
    description: normalizeOptionalText(snapshot.description),
    createdAt,
    updatedAt,
  });
};
