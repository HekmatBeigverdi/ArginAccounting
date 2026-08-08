import type {
  CompanyActivityType
} from "../domain/company.ts";
import {
  recommendCodingTemplate,
  type CodingTemplateRecommendation
} from "../domain/company-activity-type.ts";
import type {
  CompanyProfileAuthorizer
} from "../contracts/company-profile-authorizer.ts";
import type {
  CompanyUnitOfWork
} from "../contracts/company-unit-of-work.ts";
import {
  CompanyValidationError
} from "../validation/company-validation-error.ts";
import {
  companyProfilePermissions
} from "./company-profile-permissions.ts";

export interface UpdateCompanyActivityTypeCommand {
  readonly companyId: string;
  readonly activityType: CompanyActivityType;
}

export interface UpdateCompanyActivityTypeResult {
  readonly companyId: string;
  readonly activityType: CompanyActivityType;
  readonly recommendation: CodingTemplateRecommendation | null;
  readonly requiresPreviewAndConfirmation: true;
}

export async function updateCompanyActivityType(
  unitOfWork: CompanyUnitOfWork,
  authorizer: CompanyProfileAuthorizer,
  command: UpdateCompanyActivityTypeCommand
): Promise<UpdateCompanyActivityTypeResult> {
  if (!await authorizer.hasPermission(
    companyProfilePermissions.updateActivityType
  )) {
    throw new CompanyValidationError([{
      field: "permission",
      message: "اجازه تغییر نوع فعالیت شرکت را ندارید."
    }]);
  }

  return unitOfWork.run(async (repositories) => {
    const company = await repositories.companies.findById(
      command.companyId
    );
    if (!company) {
      throw new CompanyValidationError([{
        field: "companyId",
        message: "شرکت موردنظر پیدا نشد."
      }]);
    }

    const updated = {
      ...company,
      activityType: command.activityType,
      updatedAt: new Date().toISOString()
    };
    await repositories.companies.update(updated);

    return {
      companyId: updated.id,
      activityType: updated.activityType,
      recommendation: recommendCodingTemplate(updated.activityType),
      requiresPreviewAndConfirmation: true
    };
  });
}
