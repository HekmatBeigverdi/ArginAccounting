export type CodingTemplateValidationCode =
  | "identifier_required"
  | "identifier_too_long"
  | "code_required"
  | "code_invalid"
  | "code_too_long"
  | "persian_name_required"
  | "name_too_long"
  | "activity_type_invalid"
  | "ownership_invalid"
  | "source_type_invalid"
  | "version_invalid"
  | "fingerprint_invalid"
  | "contract_version_required"
  | "invalid_lifecycle_transition"
  | "published_version_required";

export class CodingTemplateValidationError extends Error {
  readonly code: CodingTemplateValidationCode;
  readonly field: string;

  constructor(
    code: CodingTemplateValidationCode,
    field: string,
    message: string,
  ) {
    super(message);
    this.name = "CodingTemplateValidationError";
    this.code = code;
    this.field = field;
  }
}
