import type {
  CompanyUnitOfWork
} from "../contracts/company-unit-of-work";

import {
  CompanyValidationError
} from "../validation/company-validation-error";

import {
  validateBranchInput
} from "../validation/validate-branch-input";

import {
  validateCompanyInput
} from "../validation/validate-company-input";

import type {
  CompanySetupInput
} from "./company-setup-input";

export interface CompanySetupResult {
  companyId: string;
  headOfficeId: string;
}

export async function setupCompany(
  unitOfWork: CompanyUnitOfWork,
  input: CompanySetupInput
): Promise<CompanySetupResult> {
  const companyIssues = validateCompanyInput(input.company);

  const branchIssues = validateBranchInput({
    companyId: "pending",
    code: input.headOffice.code,
    name: input.headOffice.name,
    isHeadOffice: true
  });

  const issues = [
    ...companyIssues,
    ...branchIssues
  ];

  if (issues.length > 0) {
    throw new CompanyValidationError(issues);
  }

  return unitOfWork.transaction(async (repositories) => {
    const existingCompany =
      await repositories.companies.findByCode(
        input.company.code.trim()
      );

    if (existingCompany !== null) {
      throw new CompanyValidationError([
        {
          field: "code",
          message: "شرکتی با این کد قبلاً ثبت شده است."
        }
      ]);
    }

    const company = await repositories.companies.create({
      code: input.company.code.trim(),
      legalName: input.company.legalName.trim(),
      tradeName: input.company.tradeName?.trim() || null,
      nationalId: input.company.nationalId?.trim() || null,
      registrationNumber:
        input.company.registrationNumber?.trim() || null
    });

    const headOffice = await repositories.branches.create({
      companyId: company.id,
      code: input.headOffice.code.trim(),
      name: input.headOffice.name.trim(),
      isHeadOffice: true
    });

    if (input.address) {
      await repositories.addresses.create({
        ownerType: "branch",
        ownerId: headOffice.id,
        addressType: "registered",
        province: input.address.province?.trim() || null,
        city: input.address.city?.trim() || null,
        addressLine: input.address.addressLine.trim(),
        postalCode: input.address.postalCode?.trim() || null,
        phone: input.address.phone?.trim() || null,
        isPrimary: true
      });
    }

    if (input.taxProfile) {
      await repositories.taxProfiles.create({
        companyId: company.id,
        economicCode:
          input.taxProfile.economicCode?.trim() || null,
        fiscalId:
          input.taxProfile.fiscalId?.trim() || null,
        sellerBranchCode:
          input.taxProfile.sellerBranchCode?.trim() || null,
        taxpayerType: input.taxProfile.taxpayerType,
        isEnabled: input.taxProfile.isEnabled
      });
    }

    return {
      companyId: company.id,
      headOfficeId: headOffice.id
    };
  });
}
