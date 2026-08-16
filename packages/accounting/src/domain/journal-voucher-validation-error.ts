export type JournalVoucherValidationCode =
  | "identifier_required"
  | "identifier_too_long"
  | "number_required"
  | "number_too_long"
  | "text_too_long"
  | "date_invalid"
  | "currency_invalid"
  | "version_invalid"
  | "line_order_invalid"
  | "line_order_duplicate"
  | "line_amount_invalid"
  | "line_side_invalid"
  | "minimum_lines_required"
  | "voucher_unbalanced"
  | "currency_mismatch";

export class JournalVoucherValidationError extends Error {
  readonly code: JournalVoucherValidationCode;
  readonly field: string;

  constructor(
    code: JournalVoucherValidationCode,
    field: string,
    message: string,
  ) {
    super(message);
    this.name = "JournalVoucherValidationError";
    this.code = code;
    this.field = field;
  }
}
