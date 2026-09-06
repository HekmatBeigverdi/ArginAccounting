export type WarehouseDependencyKind =
  | "stock-balance"
  | "inventory-document"
  | "purchase-document"
  | "sales-document"
  | "manufacturing-document"
  | "accounting-reference"
  | "other";

export interface WarehouseDependencyBlocker {
  readonly kind: WarehouseDependencyKind;
  readonly code: string;
  readonly count: number;
  readonly message: string;
}

export interface WarehouseDependencyCheck {
  readonly allowed: boolean;
  readonly blockers: readonly WarehouseDependencyBlocker[];
}

export type WarehouseProtectedOperation =
  | "warehouse.delete"
  | "warehouse.deactivate"
  | "warehouse.archive"
  | "zone.delete"
  | "zone.deactivate"
  | "location.delete"
  | "location.deactivate"
  | "location.move";

export interface WarehouseDependencyGuard {
  check(input: {
    readonly companyId: string;
    readonly operation: WarehouseProtectedOperation;
    readonly warehouseId: string;
    readonly zoneId?: string | null;
    readonly locationId?: string | null;
  }): Promise<WarehouseDependencyCheck>;
}

/**
 * Used until Inventory/Purchase/Sales/Manufacturing modules provide concrete
 * dependency probes. Structural dependencies inside Warehouse are still
 * enforced by WarehouseService itself and are never bypassed by this guard.
 */
export const allowUnintegratedWarehouseDependencies: WarehouseDependencyGuard = Object.freeze({
  async check() {
    return Object.freeze({ allowed: true, blockers: Object.freeze([]) });
  },
});
