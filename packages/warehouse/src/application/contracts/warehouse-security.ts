import type {
  ChangeWarehouseScopeCommand,
  ChangeWarehouseStatusCommand,
  CreateWarehouseCommand,
  CreateWarehouseLocationCommand,
  CreateWarehouseZoneCommand,
  UpdateWarehouseCommand,
} from "./warehouse-commands.ts";

export const warehousePermissions = Object.freeze({
  view: "inventory.warehouses.view",
  create: "inventory.warehouses.create",
  update: "inventory.warehouses.update",
  changeStatus: "inventory.warehouses.change-status",
  manageScope: "inventory.warehouses.manage-scope",
  manageLocations: "inventory.warehouses.manage-locations",
  import: "inventory.warehouses.import",
  export: "inventory.warehouses.export",
} as const);

export type WarehousePermission =
  (typeof warehousePermissions)[keyof typeof warehousePermissions];

export interface WarehouseSecurityContext {
  readonly actorId: string;
  readonly correlationId?: string | null;
}

export interface WarehouseReadSecurityContext extends WarehouseSecurityContext {
  readonly requestId: string;
}

export interface WarehouseAuthorizationContext {
  readonly actorId: string;
  readonly companyId: string;
  readonly correlationId: string;
  readonly requestId: string;
}

export interface WarehouseAuthorizationPolicy {
  require(
    context: WarehouseAuthorizationContext,
    permission: WarehousePermission,
  ): Promise<void>;
}

export type WarehouseAuditAction =
  | "warehouse.create"
  | "warehouse.update"
  | "warehouse.change-status"
  | "warehouse.change-scope"
  | "warehouse.zone.create"
  | "warehouse.location.create";

export interface WarehouseAuditEvent {
  readonly action: WarehouseAuditAction;
  readonly actorId: string;
  readonly companyId: string;
  readonly warehouseId: string;
  readonly childEntityId: string | null;
  readonly correlationId: string;
  readonly requestId: string;
  readonly occurredAt: string;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
}

/**
 * Audit persistence must be append-only and idempotent for a repeated
 * (action, requestId, warehouseId, childEntityId) tuple. The Warehouse
 * service already provides request idempotency, so retried mutations must
 * not create duplicate audit facts.
 */
export interface WarehouseAuditSink {
  record(event: WarehouseAuditEvent): Promise<void>;
}

export type WarehouseMutationCommand =
  | CreateWarehouseCommand
  | UpdateWarehouseCommand
  | ChangeWarehouseStatusCommand
  | ChangeWarehouseScopeCommand
  | CreateWarehouseZoneCommand
  | CreateWarehouseLocationCommand;

export const warehouseCorrelationId = (
  context: WarehouseSecurityContext,
  requestId: string,
): string => {
  const correlationId = context.correlationId?.trim();
  return correlationId && correlationId.length > 0
    ? correlationId
    : requestId.trim();
};

/**
 * Phase 19 does not introduce a Warehouse approval workflow. Warehouse
 * master-data mutations are authorization + audit controlled. The generic
 * Approval aggregate remains available to future consumers, but enabling it
 * for Warehouse requires an explicit domain requirement / Change Request.
 */
export const warehouseApprovalIntegration = Object.freeze({
  mode: "not-required",
  approvalRequestType: null,
} as const);
