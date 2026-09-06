import {
  WAREHOUSE_DOMAIN_ERROR_CODES,
  WarehouseDomainError,
} from "./warehouse.ts";
import type { ClassifiedWarehouseSnapshot } from "./warehouse-lifecycle.ts";

export type WarehouseOrganizationalScope =
  | Readonly<{ mode: "company" }>
  | Readonly<{ mode: "branch"; branchId: string }>;

export interface WarehouseBranchReference {
  readonly branchId: string;
  readonly companyId: string;
  readonly status: "active" | "inactive";
}

export interface OrganizedWarehouseSnapshot extends ClassifiedWarehouseSnapshot {
  readonly organizationalScope: WarehouseOrganizationalScope;
}

export interface AssignWarehouseOrganizationalScopeInput {
  readonly warehouse: ClassifiedWarehouseSnapshot;
  readonly scope: WarehouseOrganizationalScope;
  readonly branch?: WarehouseBranchReference;
}

export interface ChangeWarehouseOrganizationalScopeInput {
  readonly warehouse: OrganizedWarehouseSnapshot;
  readonly scope: WarehouseOrganizationalScope;
  readonly occurredAt: string;
  readonly branch?: WarehouseBranchReference;
}

const normalizeRequired = (value: string, code: keyof typeof WAREHOUSE_DOMAIN_ERROR_CODES): string => {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (normalized.length === 0) {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES[code]);
  }
  return normalized;
};

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

const canonicalizeScope = (
  warehouseCompanyId: string,
  scope: WarehouseOrganizationalScope,
  branch: WarehouseBranchReference | undefined,
  requireActiveBranch: boolean,
): WarehouseOrganizationalScope => {
  if (scope.mode === "company") {
    return Object.freeze({ mode: "company" });
  }

  if (scope.mode !== "branch") {
    throw new WarehouseDomainError(
      WAREHOUSE_DOMAIN_ERROR_CODES.organizationalScopeInvalid,
    );
  }

  const branchId = normalizeRequired(scope.branchId, "branchIdRequired");
  if (branch == null) {
    throw new WarehouseDomainError(
      WAREHOUSE_DOMAIN_ERROR_CODES.branchReferenceRequired,
    );
  }

  const referenceBranchId = normalizeRequired(branch.branchId, "branchIdRequired");
  if (referenceBranchId !== branchId) {
    throw new WarehouseDomainError(
      WAREHOUSE_DOMAIN_ERROR_CODES.branchReferenceMismatch,
    );
  }

  if (branch.companyId.trim() !== warehouseCompanyId.trim()) {
    throw new WarehouseDomainError(
      WAREHOUSE_DOMAIN_ERROR_CODES.branchCompanyMismatch,
    );
  }

  if (requireActiveBranch && branch.status !== "active") {
    throw new WarehouseDomainError(WAREHOUSE_DOMAIN_ERROR_CODES.branchInactive);
  }

  return Object.freeze({ mode: "branch", branchId });
};

const freezeOrganized = (
  snapshot: OrganizedWarehouseSnapshot,
): OrganizedWarehouseSnapshot => Object.freeze({ ...snapshot });

export const assignWarehouseOrganizationalScope = (
  input: AssignWarehouseOrganizationalScopeInput,
): OrganizedWarehouseSnapshot =>
  freezeOrganized({
    ...input.warehouse,
    organizationalScope: canonicalizeScope(
      input.warehouse.companyId,
      input.scope,
      input.branch,
      true,
    ),
  });

export const rehydrateOrganizedWarehouse = (
  snapshot: OrganizedWarehouseSnapshot,
  branch?: WarehouseBranchReference,
): OrganizedWarehouseSnapshot =>
  freezeOrganized({
    ...snapshot,
    organizationalScope: canonicalizeScope(
      snapshot.companyId,
      snapshot.organizationalScope,
      branch,
      false,
    ),
  });

export const changeWarehouseOrganizationalScope = (
  input: ChangeWarehouseOrganizationalScopeInput,
): OrganizedWarehouseSnapshot => {
  if (input.warehouse.status === "archived") {
    throw new WarehouseDomainError(
      WAREHOUSE_DOMAIN_ERROR_CODES.archivedOrganizationChangeForbidden,
    );
  }

  const organizationalScope = canonicalizeScope(
    input.warehouse.companyId,
    input.scope,
    input.branch,
    true,
  );

  const current = input.warehouse.organizationalScope;
  const unchanged =
    current.mode === organizationalScope.mode &&
    (current.mode === "company" ||
      (organizationalScope.mode === "branch" &&
        current.branchId === organizationalScope.branchId));

  if (unchanged) {
    return input.warehouse;
  }

  return freezeOrganized({
    ...input.warehouse,
    organizationalScope,
    updatedAt: assertForwardTimestamp(
      input.warehouse.updatedAt,
      input.occurredAt,
    ),
  });
};
