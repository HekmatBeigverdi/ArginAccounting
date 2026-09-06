export const WAREHOUSE_ERP_CONSUMERS = Object.freeze([
  "inventory",
  "purchases",
  "sales",
  "transfer",
  "adjustment",
  "manufacturing",
  "cost-accounting",
  "accounting",
  "taxpayer",
] as const);

export type WarehouseErpConsumer = (typeof WAREHOUSE_ERP_CONSUMERS)[number];

/**
 * Durable reference that downstream ERP records may persist.
 * Code/title are intentionally absent because they are mutable display metadata.
 */
export interface WarehouseOperationalReference {
  readonly warehouseId: string;
  readonly zoneId?: string | null;
  readonly locationId?: string | null;
}

export type WarehouseIntegrationContractErrorCode =
  | "warehouse.integration.warehouse-id.required"
  | "warehouse.integration.zone-id.required-for-location";

export class WarehouseIntegrationContractError extends Error {
  constructor(readonly code: WarehouseIntegrationContractErrorCode) {
    super(code);
    this.name = "WarehouseIntegrationContractError";
  }
}

export function createWarehouseOperationalReference(input: {
  readonly warehouseId: string;
  readonly zoneId?: string | null;
  readonly locationId?: string | null;
}): WarehouseOperationalReference {
  const warehouseId = input.warehouseId.trim();
  if (!warehouseId) {
    throw new WarehouseIntegrationContractError(
      "warehouse.integration.warehouse-id.required",
    );
  }

  const zoneId = input.zoneId?.trim() || null;
  const locationId = input.locationId?.trim() || null;
  if (locationId && !zoneId) {
    throw new WarehouseIntegrationContractError(
      "warehouse.integration.zone-id.required-for-location",
    );
  }

  return Object.freeze({
    warehouseId,
    ...(zoneId ? { zoneId } : {}),
    ...(locationId ? { locationId } : {}),
  });
}

/**
 * Canonical ownership boundary for Phase 19 and later ERP modules.
 * `warehouse` owns only master definitions and reference eligibility.
 */
export const WAREHOUSE_ERP_OWNERSHIP = Object.freeze({
  warehouse: Object.freeze([
    "warehouse-master-data",
    "zone-master-data",
    "location-master-data",
    "organizational-scope",
    "master-lifecycle",
    "selector-eligibility",
  ] as const),
  inventory: Object.freeze([
    "stock-balance",
    "stock-movement",
    "kardex",
    "reservation",
    "stock-count",
  ] as const),
  valuation: Object.freeze([
    "cost-layer",
    "inventory-valuation",
    "moving-average",
    "fifo",
  ] as const),
  purchases: Object.freeze([
    "purchase-document",
    "receipt-document",
    "purchase-price",
  ] as const),
  sales: Object.freeze([
    "sales-document",
    "dispatch-document",
    "sales-price",
  ] as const),
  transfer: Object.freeze([
    "warehouse-transfer-document",
    "transfer-state",
  ] as const),
  adjustment: Object.freeze([
    "inventory-adjustment-document",
    "count-adjustment",
  ] as const),
  manufacturing: Object.freeze([
    "production-consumption",
    "production-output",
    "wip-transaction",
  ] as const),
  costAccounting: Object.freeze([
    "production-cost",
    "cost-allocation",
  ] as const),
  accounting: Object.freeze([
    "posting-rule",
    "journal-posting",
    "inventory-accounting-entry",
  ] as const),
  taxpayer: Object.freeze([
    "taxpayer-projection",
    "signing",
    "submission",
    "inquiry",
  ] as const),
  synchronization: Object.freeze([
    "outbox",
    "transport",
    "retry",
    "acknowledgement",
    "conflict-resolution",
  ] as const),
});

/**
 * Warehouse is a provider boundary. Downstream modules may depend on Warehouse
 * references/selectors; Warehouse must not import their transactional models.
 */
export const warehouseIntegrationDirection = Object.freeze({
  direction: "warehouse-to-consumer" as const,
  reverseDependencyAllowed: false,
  mutableDisplayMetadataAsForeignIdentity: false,
});
