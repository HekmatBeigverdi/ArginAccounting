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

  return unitOfWork.run(async (repositories) => {
    console.log("شروع تراکنش...");

    const existingCompany =
      await repositories.companies.findByCode(
        input.company.code.trim()
      );

    console.log("نتیجه جستجوی شرکت موجود:", existingCompany);

    if (existingCompany !== null) {
      throw new CompanyValidationError([
        {
          field: "code",
          message: "شرکتی با این کد قبلاً ثبت شده است."
        }
      ]);
    }

    console.log("در حال ایجاد شرکت...");
    const company = await repositories.companies.create({
      code: input.company.code.trim(),
      legalName: input.company.legalName.trim(),
      tradeName: input.company.tradeName?.trim() || null,
      nationalId: input.company.nationalId?.trim() || null,
      registrationNumber:
        input.company.registrationNumber?.trim() || null,
      activityType: input.company.activityType
    });
    console.log("شرکت ایجاد شد:", company.id);

    console.log("در حال ایجاد شعبه...");
    const headOffice = await repositories.branches.create({
      companyId: company.id,
      code: input.headOffice.code.trim(),
      name: input.headOffice.name.trim(),
      isHeadOffice: true
    });
    console.log("شعبه ایجاد شد:", headOffice.id);

    if (input.address) {
      console.log("در حال ایجاد آدرس...");
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
      console.log("آدرس ایجاد شد");
    }

    if (input.taxProfile) {
      console.log("در حال ایجاد پروفایل مالیاتی...");
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
      console.log("پروفایل مالیاتی ایجاد شد");
    }

    console.log("تراکنش با موفقیت به پایان رسید");
    return {
      companyId: company.id,
      headOfficeId: headOffice.id
    };
  });
}
