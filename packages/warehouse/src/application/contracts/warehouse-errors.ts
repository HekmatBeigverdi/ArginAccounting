export const WAREHOUSE_APPLICATION_ERROR_CODES = {
  invalidRequest: "warehouse.application.invalid-request",
  notFound: "warehouse.application.not-found",
  duplicateIdentifier: "warehouse.application.duplicate-identifier",
  concurrencyConflict: "warehouse.application.concurrency-conflict",
  branchReferenceInvalid: "warehouse.application.branch-reference-invalid",
  archivedMutationForbidden: "warehouse.application.archived-mutation-forbidden",
  dependencyBlocked: "warehouse.application.dependency-blocked",
  structuralDependencyBlocked: "warehouse.application.structural-dependency-blocked",
  moveCycle: "warehouse.application.move-cycle",
  unauthorized: "warehouse.application.unauthorized",
} as const;

export type WarehouseApplicationErrorCode =
  (typeof WAREHOUSE_APPLICATION_ERROR_CODES)[keyof typeof WAREHOUSE_APPLICATION_ERROR_CODES];

export class WarehouseApplicationError extends Error {
  constructor(public readonly code: WarehouseApplicationErrorCode) {
    super(code);
    this.name = "WarehouseApplicationError";
  }
}
