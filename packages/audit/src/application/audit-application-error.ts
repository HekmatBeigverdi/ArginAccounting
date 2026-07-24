export class AuditEntityNotFoundError
extends Error {
  constructor(
    readonly entityName: "audit-entry" | "approval-request",
    readonly entityId: string
  ) {
    super(
      `${entityName} "${entityId}" was not found.`
    );

    this.name = "AuditEntityNotFoundError";

    Object.setPrototypeOf(
      this,
      AuditEntityNotFoundError.prototype
    );
  }
}
