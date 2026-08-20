import type {
  CreateBranchInput
} from "../domain/branch.ts";

import type {
  CompanyValidationIssue
} from "./company-validation-error.ts";

export function validateBranchInput(
  input: CreateBranchInput
): CompanyValidationIssue[] {
  const issues: CompanyValidationIssue[] = [];

  if (input.code.trim().length === 0) {
    issues.push({
      field: "branchCode",
      message: "کد شعبه الزامی است."
    });
  }

  if (input.name.trim().length === 0) {
    issues.push({
      field: "branchName",
      message: "نام شعبه الزامی است."
    });
  }

  return issues;
}
