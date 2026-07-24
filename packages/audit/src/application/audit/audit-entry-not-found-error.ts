export class AuditEntryNotFoundError extends Error {
  constructor(readonly auditEntryId: string) {
    super(
      `Audit entry "${auditEntryId}" was not found.`
    );

    this.name = "AuditEntryNotFoundError";

    Object.setPrototypeOf(
      this,
      AuditEntryNotFoundError.prototype
    );
  }
}
