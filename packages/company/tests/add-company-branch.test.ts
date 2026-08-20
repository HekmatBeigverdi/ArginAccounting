import assert from "node:assert/strict";
import test from "node:test";

import type { Branch } from "../src/domain/branch.ts";
import type { Company } from "../src/domain/company.ts";
import type { CompanyUnitOfWorkRepositories } from "../src/contracts/company-unit-of-work.ts";
import { addCompanyBranch } from "../src/application/add-company-branch.ts";
import { CompanyValidationError } from "../src/validation/company-validation-error.ts";

const company: Company = {
  id: "company-1",
  code: "MAIN",
  legalName: "شرکت آزمون",
  tradeName: null,
  nationalId: null,
  registrationNumber: null,
  activityType: "service",
  baseCurrency: "IRR",
  locale: "fa-IR",
  calendar: "jalali",
  status: "active",
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z"
};

function fixture(existing: Branch[] = []) {
  let createdInput: { companyId: string; code: string; name: string; isHeadOffice: boolean } | null = null;
  const createdBranch: Branch = {
    id: "branch-2",
    companyId: company.id,
    code: "02",
    name: "شعبه دوم",
    isHeadOffice: false,
    status: "active",
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z"
  };

  const unitOfWork = {
    run: async <T>(operation: (repositories: CompanyUnitOfWorkRepositories) => Promise<T>) =>
      operation({
        companies: {
          create: async () => company,
          findById: async (id: string) => id === company.id ? company : null,
          findByCode: async () => null,
          findAll: async () => [company],
          update: async () => undefined
        },
        branches: {
          create: async (input) => {
            createdInput = input;
            return createdBranch;
          },
          findById: async () => null,
          findByCompanyId: async () => existing,
          findHeadOffice: async () => null,
          findAll: async () => existing,
          update: async () => undefined
        },
        addresses: {} as CompanyUnitOfWorkRepositories["addresses"],
        taxProfiles: {} as CompanyUnitOfWorkRepositories["taxProfiles"]
      })
  };

  return { unitOfWork, getCreatedInput: () => createdInput };
}

test("adds a non-head-office branch using the existing branch repository", async () => {
  const context = fixture();
  const branch = await addCompanyBranch(context.unitOfWork, {
    companyId: company.id,
    code: " 02 ",
    name: " شعبه دوم "
  });

  assert.equal(branch.id, "branch-2");
  assert.deepEqual(context.getCreatedInput(), {
    companyId: company.id,
    code: "02",
    name: "شعبه دوم",
    isHeadOffice: false
  });
});

test("rejects duplicate branch code inside the selected company", async () => {
  const context = fixture([{
    id: "branch-1",
    companyId: company.id,
    code: "02",
    name: "شعبه موجود",
    isHeadOffice: false,
    status: "active",
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z"
  }]);

  await assert.rejects(
    addCompanyBranch(context.unitOfWork, {
      companyId: company.id,
      code: "02",
      name: "شعبه دوم"
    }),
    CompanyValidationError
  );
  assert.equal(context.getCreatedInput(), null);
});
