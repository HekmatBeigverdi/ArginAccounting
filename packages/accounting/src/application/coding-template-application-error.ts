export type CodingTemplateApplicationErrorCode =
  | "permission_denied"
  | "confirmation_required"
  | "invalid_identifier"
  | "template_not_found"
  | "template_not_published"
  | "version_not_found"
  | "preview_not_applicable"
  | "stale_preview"
  | "request_key_reused"
  | "repository_unavailable";

export class CodingTemplateApplicationError extends Error {
  constructor(
    readonly code: CodingTemplateApplicationErrorCode,
    readonly field: string | null,
  ) {
    super(`accounting.coding-template-application.${code}`);
    this.name = "CodingTemplateApplicationError";
  }
}
