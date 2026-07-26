export class NestedTransactionError
  extends Error {
  readonly code =
    "data.nested-transaction" as const;

  constructor() {
    super(
      "Nested database transactions are not supported.",
    );

    this.name = "NestedTransactionError";
  }
}
