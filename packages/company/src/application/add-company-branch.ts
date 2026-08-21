import type { Branch } from "../domain/branch.ts";
import type { CompanyUnitOfWork } from "../contracts/company-unit-of-work.ts";
import { CompanyValidationError } from "../validation/company-validation-error.ts";
import { validateBranchInput } from "../validation/validate-branch-input.ts";

export interface AddCompanyBranchCommand {
  companyId: string;
  code: string;
  name: string;
}

export async function addCompanyBranch(
  unitOfWork: CompanyUnitOfWork,
  command: AddCompanyBranchCommand
): Promise<Branch> {
  const normalized = {
    companyId: command.companyId.trim(),
    code: command.code.trim(),
    name: command.name.trim(),
    isHeadOffice: false
  };

  const issues = validateBranchInput(normalized);
  if (normalized.companyId.length === 0) {
    issues.push({
      field: "companyId",
      message: "شرکت برای ثبت شعبه باید مشخص باشد."
    });
  }
  if (issues.length > 0) throw new CompanyValidationError(issues);

  return unitOfWork.run(async (repositories) => {
    const company = await repositories.companies.findById(normalized.companyId);
    if (company === null) {
      throw new CompanyValidationError([{
        field: "companyId",
        message: "شرکت انتخاب‌شده یافت نشد."
      }]);
    }

    const branches = await repositories.branches.findByCompanyId(normalized.companyId);
    const duplicate = branches.some(
      (branch) => branch.code.trim().toLocaleLowerCase() === normalized.code.toLocaleLowerCase()
    );
    if (duplicate) {
      throw new CompanyValidationError([{
        field: "branchCode",
        message: "شعبه‌ای با این کد برای شرکت ثبت شده است."
      }]);
    }

    return repositories.branches.create(normalized);
  });
}
