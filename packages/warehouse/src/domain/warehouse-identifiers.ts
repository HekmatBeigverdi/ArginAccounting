import {
  WAREHOUSE_DOMAIN_ERROR_CODES,
  WarehouseDomainError,
  type WarehouseSnapshot,
} from "./warehouse.ts";

export interface WarehouseExternalIdentifier {
  readonly namespace: string;
  readonly value: string;
}

export interface WarehouseIdentifierSnapshot {
  readonly warehouseId: string;
  readonly companyId: string;
  readonly code: string;
  readonly externalIdentifiers: readonly WarehouseExternalIdentifier[];
}

export interface WarehouseDuplicateCandidate {
  readonly warehouseId: string;
  readonly companyId: string;
  readonly code: string;
  readonly externalIdentifiers?: readonly WarehouseExternalIdentifier[];
}

const normalizeRequired = (value: string, code: "namespace" | "value"): string => {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (normalized.length === 0) {
    throw new WarehouseDomainError(
      code === "namespace"
        ? WAREHOUSE_DOMAIN_ERROR_CODES.externalIdentifierNamespaceRequired
        : WAREHOUSE_DOMAIN_ERROR_CODES.externalIdentifierValueRequired,
    );
  }
  return normalized;
};

export const normalizeWarehouseCode = (value: string): string =>
  value.trim().replace(/\s+/gu, " ").toUpperCase();

export const normalizeWarehouseExternalIdentifier = (
  identifier: WarehouseExternalIdentifier,
): WarehouseExternalIdentifier =>
  Object.freeze({
    namespace: normalizeRequired(identifier.namespace, "namespace").toUpperCase(),
    value: normalizeRequired(identifier.value, "value"),
  });

const externalIdentifierKey = (identifier: WarehouseExternalIdentifier): string => {
  const normalized = normalizeWarehouseExternalIdentifier(identifier);
  return `${normalized.namespace}\u0000${normalized.value}`;
};

export const createWarehouseIdentifierSnapshot = (
  warehouse: WarehouseSnapshot,
  externalIdentifiers: readonly WarehouseExternalIdentifier[] = [],
): WarehouseIdentifierSnapshot => {
  const normalizedIdentifiers = externalIdentifiers.map(
    normalizeWarehouseExternalIdentifier,
  );
  const seen = new Set<string>();
  for (const identifier of normalizedIdentifiers) {
    const key = externalIdentifierKey(identifier);
    if (seen.has(key)) {
      throw new WarehouseDomainError(
        WAREHOUSE_DOMAIN_ERROR_CODES.duplicateExternalIdentifier,
      );
    }
    seen.add(key);
  }

  return Object.freeze({
    warehouseId: warehouse.warehouseId,
    companyId: warehouse.companyId,
    code: normalizeWarehouseCode(warehouse.code),
    externalIdentifiers: Object.freeze([...normalizedIdentifiers]),
  });
};

export const assertWarehouseIdentifiersUnique = (
  candidate: WarehouseDuplicateCandidate,
  existing: readonly WarehouseDuplicateCandidate[],
): void => {
  const candidateWarehouseId = candidate.warehouseId.trim();
  const candidateCompanyId = candidate.companyId.trim();
  const candidateCode = normalizeWarehouseCode(candidate.code);
  const candidateExternalKeys = new Set(
    (candidate.externalIdentifiers ?? []).map(externalIdentifierKey),
  );

  for (const current of existing) {
    if (current.warehouseId.trim() === candidateWarehouseId) {
      throw new WarehouseDomainError(
        WAREHOUSE_DOMAIN_ERROR_CODES.duplicateWarehouseId,
      );
    }

    if (current.companyId.trim() !== candidateCompanyId) {
      continue;
    }

    if (normalizeWarehouseCode(current.code) === candidateCode) {
      throw new WarehouseDomainError(
        WAREHOUSE_DOMAIN_ERROR_CODES.duplicateCode,
      );
    }

    for (const identifier of current.externalIdentifiers ?? []) {
      if (candidateExternalKeys.has(externalIdentifierKey(identifier))) {
        throw new WarehouseDomainError(
          WAREHOUSE_DOMAIN_ERROR_CODES.duplicateExternalIdentifier,
        );
      }
    }
  }
};
