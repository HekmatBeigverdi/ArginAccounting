import assert from "node:assert/strict";
import test from "node:test";

import type {
  Company,
} from "../src/domain/company.ts";
import type {
  CompanyUnitOfWorkRepositories
} from "../src/contracts/company-unit-of-work.ts";
import {
  CompanyValidationError
} from "../src/validation/company-validation-error.ts";
import {
  updateCompanyActivityType
} from "../src/application/update-company-activity-type.ts";

const company: Company = {
  id: "company-1",
  code: "MAIN",
  legalName: "شرکت آزمون",
  tradeName: null,
  nationalId: null,
  registrationNumber: null,
  activityType: "custom",
  baseCurrency: "IRR",
  locale: "fa-IR",
  calendar: "jalali",
  status: "active",
  createdAt: "2026-08-02T00:00:00.000Z",
  updatedAt: "2026-08-02T00:00:00.000Z"
};

function fixture(allowed: boolean) {
  let saved: Company | null = null;
  const companies = {
    create: async () => company,
    findById: async () => company,
    findByCode: async () => null,
    findAll: async () => [company],
    update: async (value: Company) => { saved = value; }
  };
  const unitOfWork = {
    run: async <T>(operation: (repositories: CompanyUnitOfWorkRepositories) => Promise<T>) =>
      operation({
        companies,
        branches: {} as CompanyUnitOfWorkRepositories["branches"],
        addresses: {} as CompanyUnitOfWorkRepositories["addresses"],
        taxProfiles: {} as CompanyUnitOfWorkRepositories["taxProfiles"]
      })
  };
  return {
    unitOfWork,
    authorizer: { hasPermission: async () => allowed },
    getSaved: () => saved
  };
}

test("updates activity and returns a non-applying recommendation", async () => {
  const context = fixture(true);
  const result = await updateCompanyActivityType(
    context.unitOfWork,
    context.authorizer,
    { companyId: company.id, activityType: "service" }
  );
  assert.equal(context.getSaved()?.activityType, "service");
  assert.equal(result.recommendation?.templateCode, "iran-service-default");
  assert.equal(result.requiresPreviewAndConfirmation, true);
});

test("requires the dedicated activity update permission", async () => {
  const context = fixture(false);
  await assert.rejects(
    updateCompanyActivityType(
      context.unitOfWork,
      context.authorizer,
      { companyId: company.id, activityType: "trading" }
    ),
    CompanyValidationError
  );
  assert.equal(context.getSaved(), null);
});
