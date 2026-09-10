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

let registeredDownstreamGuard: WarehouseDependencyGuard | null = null;

/**
 * Desktop composition may register the concrete downstream Inventory guard once the
 * database is available. Explicit per-service dependencyGuard injection still wins.
 * Passing null during provider cleanup restores the Phase 19 unintegrated fallback.
 */
export function registerWarehouseDependencyGuard(guard: WarehouseDependencyGuard | null): void {
  registeredDownstreamGuard = guard;
}

/**
 * Backward-compatible fallback for pre-Inventory composition roots. Once a downstream
 * guard is registered, the same stable object delegates every protected operation to it,
 * so existing WarehouseService instances do not need to be reconstructed.
 */
export const allowUnintegratedWarehouseDependencies: WarehouseDependencyGuard = Object.freeze({
  async check(input) {
    if (registeredDownstreamGuard) return registeredDownstreamGuard.check(input);
    return Object.freeze({ allowed: true, blockers: Object.freeze([]) });
  },
});
