export type AccountingDimensionAssignmentValidationCode =
  | "invalid_document_date"
  | "duplicate_policy"
  | "duplicate_assignment"
  | "policy_not_defined"
  | "required_dimension_missing"
  | "forbidden_dimension_assigned"
  | "dimension_type_not_found"
  | "dimension_type_inactive"
  | "multiple_members_not_allowed"
  | "duplicate_member"
  | "member_not_found"
  | "member_company_mismatch"
  | "member_type_mismatch"
  | "member_inactive"
  | "member_not_yet_valid"
  | "member_expired";

export interface AccountingDimensionAssignmentValidationIssue {
  readonly code: AccountingDimensionAssignmentValidationCode;
  readonly dimensionTypeId: string | null;
  readonly memberId: string | null;
  readonly message: string;
}

export class AccountingDimensionAssignmentValidationError
  extends Error {
  readonly issues:
    readonly AccountingDimensionAssignmentValidationIssue[];

  constructor(
    issues:
      readonly AccountingDimensionAssignmentValidationIssue[],
  ) {
    super("تخصیص ابعاد حسابداری معتبر نیست.");
    this.name =
      "AccountingDimensionAssignmentValidationError";
    this.issues = Object.freeze([...issues]);
  }
}
