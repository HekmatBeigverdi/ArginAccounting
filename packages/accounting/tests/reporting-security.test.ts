import assert from "node:assert/strict";
import test from "node:test";

import {
  accountingReportPermissions,
} from "../src/application/accounting-report-permissions.ts";
import {
  AccountingReportSecurityError,
  SecuredAccountingReportQueryService,
  assertAccountingReportExportAuthorized,
} from "../src/reporting-security.ts";
import type { AccountingReportQueryService } from "../src/reporting-application.ts";

function inner(calls: string[]): AccountingReportQueryService {
  return {
    async trialBalance() { calls.push("trial-balance"); return {} as never; },
    async generalLedger() { calls.push("general-ledger"); return {} as never; },
    async subsidiaryLedger() { calls.push("subsidiary-ledger"); return {} as never; },
    async journal() { calls.push("journal"); return {} as never; },
    async dimensions() { calls.push("dimensions"); return {} as never; },
  };
}

function security(input: {
  permissions?: readonly string[];
  companies?: readonly string[];
  branches?: readonly string[];
  allBranches?: boolean;
}) {
  const permissions = input.permissions ?? [];
  const companies = input.companies ?? ["company-1"];
  const branches = input.branches ?? ["branch-1"];
  return {
    authorizer: {
      async hasPermission(permission: string) {
        return permissions.includes(permission);
      },
    },
    scope: {
      async canAccessCompany(companyId: string) {
        return companies.includes(companyId);
      },
      async canAccessBranch(companyId: string, branchId: string) {
        return companies.includes(companyId) && branches.includes(branchId);
      },
      async canAccessAllBranches(companyId: string) {
        return companies.includes(companyId) && input.allBranches === true;
      },
    },
  };
}

const period = { fromDate: "2026-01-01", toDate: "2026-01-31" } as const;

test("denies report before invoking the inner service when permission is missing", async () => {
  const calls: string[] = [];
  const service = new SecuredAccountingReportQueryService(inner(calls), security({ allBranches: true }));

  await assert.rejects(
    () => service.trialBalance({ report: { companyId: "company-1", period } }),
    (error: unknown) => error instanceof AccountingReportSecurityError && error.code === "report.unauthorized",
  );
  assert.deepEqual(calls, []);
});

test("allows a specifically authorized branch and invokes the report service", async () => {
  const calls: string[] = [];
  const service = new SecuredAccountingReportQueryService(inner(calls), security({
    permissions: [accountingReportPermissions.viewJournal],
    branches: ["branch-1"],
  }));

  await service.journal({
    report: {
      companyId: "company-1",
      branch: { mode: "branch", branchId: "branch-1" },
      period,
    },
  });
  assert.deepEqual(calls, ["journal"]);
});

test("denies another branch without revealing which scope failed", async () => {
  const calls: string[] = [];
  const service = new SecuredAccountingReportQueryService(inner(calls), security({
    permissions: [accountingReportPermissions.viewGeneralLedger],
    branches: ["branch-1"],
  }));

  await assert.rejects(
    () => service.generalLedger({
      report: {
        companyId: "company-1",
        branch: { mode: "branch", branchId: "branch-2" },
        period,
      },
    }),
    (error: unknown) => error instanceof AccountingReportSecurityError &&
      error.code === "report.scope-denied" &&
      Object.keys(error.details).length === 0,
  );
  assert.deepEqual(calls, []);
});

test("company-wide report requires explicit all-branches scope", async () => {
  const calls: string[] = [];
  const service = new SecuredAccountingReportQueryService(inner(calls), security({
    permissions: [accountingReportPermissions.viewDimensions],
    branches: ["branch-1"],
    allBranches: false,
  }));

  await assert.rejects(
    () => service.dimensions({ report: { companyId: "company-1", period } }),
    (error: unknown) => error instanceof AccountingReportSecurityError && error.code === "report.scope-denied",
  );
  assert.deepEqual(calls, []);
});

test("export requires a separate permission and the same company/branch scope", async () => {
  const scoped = security({
    permissions: [accountingReportPermissions.export],
    branches: ["branch-1"],
  });
  await assert.doesNotReject(() => assertAccountingReportExportAuthorized({
    companyId: "company-1",
    branch: { mode: "branch", branchId: "branch-1" },
    period,
  }, scoped));

  await assert.rejects(
    () => assertAccountingReportExportAuthorized({
      companyId: "company-1",
      branch: { mode: "branch", branchId: "branch-2" },
      period,
    }, scoped),
    (error: unknown) => error instanceof AccountingReportSecurityError && error.code === "report.scope-denied",
  );
});
