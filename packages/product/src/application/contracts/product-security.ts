import type { ProductRequestContext } from "./product-commands.ts";

export const productPermissions = Object.freeze({
  view: "master-data.products.view",
  create: "master-data.products.create",
  update: "master-data.products.update",
  manageIdentifiers: "master-data.products.manage-identifiers",
  manageUnits: "master-data.products.manage-units",
  manageMasterData: "master-data.products.manage-master-data",
  changeStatus: "master-data.products.change-status",
  import: "master-data.products.import",
  export: "master-data.products.export",
  manageTaxpayerReferenceData: "master-data.products.manage-taxpayer-reference-data",
} as const);

export type ProductPermission =
  (typeof productPermissions)[keyof typeof productPermissions];

export interface ProductAuthorizationContext {
  readonly actorId: string;
  readonly companyId: string;
  readonly correlationId: string;
  readonly requestId: string;
}

export interface ProductAuthorizationPolicy {
  require(
    context: ProductAuthorizationContext,
    permission: ProductPermission,
  ): Promise<void>;
}

export type ProductAuditAction =
  | "product.create"
  | "product.update-identity"
  | "product.replace-identifiers"
  | "product.replace-units"
  | "product.replace-master-data"
  | "product.change-status"
  | "product.import"
  | "product.export"
  | "product.taxpayer-reference-data.update";

export interface ProductAuditEvent {
  readonly action: ProductAuditAction;
  readonly actorId: string;
  readonly companyId: string;
  readonly productId: string | null;
  readonly correlationId: string;
  readonly requestId: string;
  readonly occurredAt: string;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
}

/**
 * Audit persistence must be append-only and idempotent for the same
 * (action, requestId, productId) tuple. Product mutation retries are already
 * idempotent and must not create duplicate audit facts.
 */
export interface ProductAuditSink {
  record(event: ProductAuditEvent): Promise<void>;
}

export const productCorrelationId = (context: ProductRequestContext): string => {
  const correlationId = context.correlationId?.trim();
  return correlationId && correlationId.length > 0
    ? correlationId
    : context.requestId.trim();
};
