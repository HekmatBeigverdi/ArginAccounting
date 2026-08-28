import assert from "node:assert/strict";
import test from "node:test";

import type { Account } from "../src/domain/account.ts";
import type { AccountingDimensionMember } from "../src/domain/accounting-dimension-member.ts";
import type { AccountingDimensionType } from "../src/domain/accounting-dimension-type.ts";
import { createAccountingDimensionReports } from "../src/dimension-reports.ts";
import { normalizeAccountingReportQuery } from "../src/reporting.ts";
import type { AccountingReportJournalLineFact } from "../src/reporting-balance.ts";

const COMPANY_ID = "c1";
const PROJECT_DIMENSION_TYPE_ID = "project";
const PROJECT_MEMBER_ID = "p1";

function account(id: string, parentId: string | null, postingAllowed: boolean): Account {
  return {
    id,
    companyId: COMPANY_ID,
    parentId,
    level: postingAllowed ? "subsidiary" : parentId ? "general" : "group",
    code: id as Account["code"],
    name: id as Account["name"],
    englishName: null,
    nature: "uncontrolled",
    normalBalance: "debit",
    statementType: "balance_sheet",
    reportClassification: {} as Account["reportClassification"],
    postingAllowed,
    currencyEnabled: false,
    revaluationEnabled: false,
    trackingEnabled: false,
    dueDateEnabled: false,
    status: "active",
    displayOrder: 0,
    sourceType: "manual",
    sourceReferenceId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
  };
}

const dimensionTypes: AccountingDimensionType[] = [{
  id: PROJECT_DIMENSION_TYPE_ID,
  companyId: COMPANY_ID,
  code: "PRJ",
  name: "Project",
  englishName: null,
  hierarchical: true,
  allowMultipleMembers: false,
  status: "active",
  displayOrder: 0,
  source: "manual",
  sourceReferenceId: null,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  version: 1,
}];

const dimensionMembers: AccountingDimensionMember[] = [{
  id: PROJECT_MEMBER_ID,
  companyId: COMPANY_ID,
  dimensionTypeId: PROJECT_DIMENSION_TYPE_ID,
  code: "P1",
  name: "Project 1",
  englishName: null,
  parentId: null,
  status: "active",
  validFrom: null,
  validTo: null,
  displayOrder: 0,
  source: "manual",
  sourceReferenceId: null,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  version: 1,
}];

const accounts = [
  account("g", null, false),
  account("cash", "g", true),
  account("sales", "g", true),
];

function fact(
  id: string,
  accountId: string,
  voucherDate: string,
  debit: number,
  credit: number,
  isPostedFact = true,
): AccountingReportJournalLineFact {
  return {
    companyId: COMPANY_ID,
    currency: "IRR",
    branchId: "b1",
    fiscalYearId: "fy",
    fiscalPeriodId: "fp",
    voucherId: `v${id}`,
    journalLineId: id,
    voucherDate,
    accountId,
    debit,
    credit,
    isPostedFact,
    dimensions: [{
      dimensionTypeId: PROJECT_DIMENSION_TYPE_ID,
      memberId: PROJECT_MEMBER_ID,
    }],
  };
}

function reportQuery() {
  return normalizeAccountingReportQuery({
    companyId: COMPANY_ID,
    period: {
      fromDate: "2026-04-01",
      toDate: "2026-04-30",
    },
  });
}

test("aggregates opening, turnover and ending by dimension member and account member", () => {
  const result = createAccountingDimensionReports(
    reportQuery(),
    accounts,
    dimensionTypes,
    dimensionMembers,
    [
      fact("1", "cash", "2026-03-20", 100, 0),
      fact("2", "cash", "2026-04-05", 50, 0),
      fact("3", "sales", "2026-04-06", 0, 50),
    ],
  );

  assert.equal(result.byMember.length, 1);
  assert.equal(result.byMember[0]!.openingNet, 100);
  assert.equal(result.byMember[0]!.periodDebit, 50);
  assert.equal(result.byMember[0]!.periodCredit, 50);
  assert.equal(result.byMember[0]!.endingNet, 100);
  assert.equal(result.byAccountMember.length, 2);
});

test("inherits posted scope and account hierarchy selection", () => {
  const query = normalizeAccountingReportQuery({
    companyId: COMPANY_ID,
    period: {
      fromDate: "2026-04-01",
      toDate: "2026-04-30",
    },
    accounts: {
      accountId: "g",
      includeDescendants: true,
    },
  });

  const result = createAccountingDimensionReports(
    query,
    accounts,
    dimensionTypes,
    dimensionMembers,
    [
      fact("1", "cash", "2026-04-05", 10, 0),
      fact("2", "sales", "2026-04-06", 0, 10, false),
    ],
  );

  assert.equal(result.byMember[0]!.periodDebit, 10);
  assert.equal(result.byMember[0]!.periodCredit, 0);
  assert.equal(result.byAccountMember.length, 1);
});

test("applies branch, fiscal-year and dimension-member filters together", () => {
  const secondMember: AccountingDimensionMember = {
    ...dimensionMembers[0]!,
    id: "p2",
    code: "P2",
    name: "Project 2",
  };
  const query = normalizeAccountingReportQuery({
    companyId: COMPANY_ID,
    branch: { mode: "branch", branchId: "b1" },
    period: {
      fromDate: "2026-04-01",
      toDate: "2026-04-30",
      fiscalYearId: "fy",
    },
    dimensions: [{ dimensionTypeId: PROJECT_DIMENSION_TYPE_ID, memberIds: [PROJECT_MEMBER_ID] }],
  });
  const matching = fact("match", "cash", "2026-04-05", 70, 0);
  const result = createAccountingDimensionReports(
    query,
    accounts,
    dimensionTypes,
    [...dimensionMembers, secondMember],
    [
      matching,
      { ...matching, voucherId: "v-branch", journalLineId: "branch", debit: 200, branchId: "b2" },
      { ...matching, voucherId: "v-year", journalLineId: "year", debit: 300, fiscalYearId: "fy-2" },
      {
        ...matching,
        voucherId: "v-member",
        journalLineId: "member",
        debit: 400,
        dimensions: [{ dimensionTypeId: PROJECT_DIMENSION_TYPE_ID, memberId: "p2" }],
      },
    ],
  );

  assert.equal(result.byMember.length, 1);
  assert.equal(result.byMember[0]!.memberId, PROJECT_MEMBER_ID);
  assert.equal(result.byMember[0]!.periodDebit, 70);
  assert.equal(result.byAccountMember.length, 1);
});

test("rejects mismatched dimension metadata", () => {
  const mismatchedFact: AccountingReportJournalLineFact = {
    ...fact("1", "cash", "2026-04-05", 10, 0),
    dimensions: [{
      dimensionTypeId: PROJECT_DIMENSION_TYPE_ID,
      memberId: "missing",
    }],
  };

  assert.throws(
    () => createAccountingDimensionReports(
      reportQuery(),
      accounts,
      dimensionTypes,
      dimensionMembers,
      [mismatchedFact],
    ),
    /اطلاعات نوع یا عضو/,
  );
});
