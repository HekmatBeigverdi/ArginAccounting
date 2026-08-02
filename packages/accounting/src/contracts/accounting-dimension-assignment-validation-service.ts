import type { AccountingDimensionAssignment } from "../domain/accounting-dimension-assignment.ts";
import type { AccountingDimensionAssignmentValidationIssue } from "../validation/accounting-dimension-assignment-validation-error.ts";

export interface ValidateDimensionAssignmentsRequest {
  readonly companyId: string;
  readonly accountId: string;
  readonly documentDate: string;
  readonly assignments: readonly AccountingDimensionAssignment[];
}

export interface AccountingDimensionAssignmentValidationService {
  validate(request: ValidateDimensionAssignmentsRequest): Promise<readonly AccountingDimensionAssignmentValidationIssue[]>;
  assertValid(request: ValidateDimensionAssignmentsRequest): Promise<void>;
}
