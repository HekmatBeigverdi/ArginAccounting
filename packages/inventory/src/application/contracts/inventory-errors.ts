export const INVENTORY_APPLICATION_ERROR_CODES = Object.freeze({
  invalidRequest: "inventory.application.invalid-request",
  notFound: "inventory.application.not-found",
  concurrencyConflict: "inventory.application.concurrency-conflict",
  duplicateDocumentNumber: "inventory.application.document-number-duplicate",
  duplicateMovement: "inventory.application.movement-duplicate",
  duplicateOpening: "inventory.application.opening-duplicate",
  stockConflict: "inventory.application.stock-conflict",
  idempotencyConflict: "inventory.application.idempotency-conflict",
  unauthorized: "inventory.application.unauthorized",
  dependencyBlocked: "inventory.application.dependency-blocked",
} as const);

export type InventoryApplicationErrorCode =
  (typeof INVENTORY_APPLICATION_ERROR_CODES)[keyof typeof INVENTORY_APPLICATION_ERROR_CODES];

/** Stable Application-layer error. Consumers branch on code/field, never message text. */
export class InventoryApplicationError extends Error {
  constructor(
    public readonly code: InventoryApplicationErrorCode,
    public readonly field: string | null = null,
  ) {
    super(code);
    this.name = "InventoryApplicationError";
  }
}
