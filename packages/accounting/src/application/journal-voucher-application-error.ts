export type JournalVoucherApplicationErrorCode =
  | "journal.unauthorized"
  | "journal.not-found"
  | "journal.account-not-found"
  | "journal.fiscal-context-not-found"
  | "journal.validation-failed"
  | "journal.dimension-validation-failed"
  | "journal.numbering-failed"
  | "journal.duplicate-number"
  | "journal.version-conflict"
  | "journal.invalid-query"
  | "journal.persistence-failed";

export class JournalVoucherApplicationError extends Error {
  constructor(
    readonly code: JournalVoucherApplicationErrorCode,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "JournalVoucherApplicationError";
  }
}
