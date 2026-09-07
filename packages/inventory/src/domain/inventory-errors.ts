export const INVENTORY_DOMAIN_ERROR_CODES = Object.freeze({
  scopeInvalid: "inventory.scope.invalid",
  scopeRequired: "inventory.scope.required",
  companyScopeMismatch: "inventory.scope.company-mismatch",
  branchAccessDenied: "inventory.scope.branch-access-denied",
  branchScopeMismatch: "inventory.scope.branch-mismatch",
  crossBranchTransferDenied: "inventory.scope.cross-branch-transfer-denied",
  fiscalScopeInvalid: "inventory.scope.fiscal-invalid",
  historicalLockBlocked: "inventory.scope.historical-lock",
  warehouseBranchMismatch: "inventory.scope.warehouse-branch-mismatch",
  numberAlreadyAssigned: "inventory.number.already-assigned",
  numberResultInvalid: "inventory.number.result-invalid",
  quantityInvalid: "inventory.quantity.invalid",
  quantityPrecisionInvalid: "inventory.quantity.precision-invalid",
  quantityZero: "inventory.quantity.zero",
  unitInvalid: "inventory.unit.invalid",
  unitNotFound: "inventory.unit.not-found",
  quantitySnapshotMismatch: "inventory.quantity.snapshot-mismatch",
  productIneligible: "inventory.product.ineligible",
  productReferenceMismatch: "inventory.product.reference-mismatch",
  referenceInvalid: "inventory.reference.invalid",
  referenceMismatch: "inventory.reference.mismatch",
  referenceIneligible: "inventory.reference.ineligible",
  operationMismatch: "inventory.operation.mismatch",
  inputInvalid: "inventory.input.invalid",
  identityRequired: "inventory.identity.required",
  documentTypeInvalid: "inventory.document-type.invalid",
  businessDateInvalid: "inventory.business-date.invalid",
  timestampInvalid: "inventory.timestamp.invalid",
  timestampOrderInvalid: "inventory.timestamp-order.invalid",
  versionInvalid: "inventory.version.invalid",
  statusInvalid: "inventory.status.invalid",
  linesInvalid: "inventory.lines.invalid",
  linePositionInvalid: "inventory.line-position.invalid",
  duplicateLineId: "inventory.line-id.duplicate",
  duplicateLinePosition: "inventory.line-position.duplicate",
  sourceCompanyMismatch: "inventory.source.company-mismatch",
  sourceSelfReference: "inventory.source.self-reference",
} as const);

export type InventoryDomainErrorCode =
  (typeof INVENTORY_DOMAIN_ERROR_CODES)[keyof typeof INVENTORY_DOMAIN_ERROR_CODES];

export class InventoryDomainError extends Error {
  readonly code: InventoryDomainErrorCode;
  readonly field: string;

  constructor(code: InventoryDomainErrorCode, field: string) {
    super(code);
    this.name = "InventoryDomainError";
    this.code = code;
    this.field = field;
  }
}
