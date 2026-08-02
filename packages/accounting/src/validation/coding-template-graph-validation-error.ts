export type CodingTemplateGraphItemType =
  | "account"
  | "dimension_type"
  | "dimension_member"
  | "account_dimension_policy";

export type CodingTemplateGraphValidationCode =
  | "logical_key_required"
  | "logical_key_invalid"
  | "duplicate_logical_key"
  | "duplicate_code"
  | "duplicate_policy"
  | "invalid_item"
  | "parent_required"
  | "parent_not_allowed"
  | "parent_not_found"
  | "parent_level_invalid"
  | "parent_dimension_mismatch"
  | "hierarchy_cycle"
  | "dimension_type_not_found"
  | "account_not_found"
  | "members_not_allowed"
  | "policy_not_allowed"
  | "policy_requirement_invalid";

export interface CodingTemplateGraphValidationIssue {
  readonly code: CodingTemplateGraphValidationCode;
  readonly itemType: CodingTemplateGraphItemType;
  readonly logicalKey: string | null;
  readonly field: string;
  readonly message: string;
}

export class CodingTemplateGraphValidationError extends Error {
  readonly issues: readonly CodingTemplateGraphValidationIssue[];

  constructor(issues: readonly CodingTemplateGraphValidationIssue[]) {
    super("گراف اقلام الگوی کدینگ معتبر نیست.");
    this.name = "CodingTemplateGraphValidationError";
    this.issues = Object.freeze([...issues]);
  }
}
