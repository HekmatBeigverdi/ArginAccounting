import assert from "node:assert/strict";
import test from "node:test";

import { createAccount } from "../src/index.ts";
import {
  JournalVoucherEligibilityError,
  assertJournalVoucherEligibility,
  validateJournalVoucherEligibility,
  type JournalFiscalContext,
} from "../src/validation/journal-voucher-eligibility.ts";

function createPostingAccount(overrides: Record<string, unknown> = {}) {
  return createAccount({
    id: "account-1",
    companyId: "company-1",
    parentId: "general-1",
    level: "subsidiary",
    code: "110101",
    name: "بانک",
    nature: "debit",
    normalBalance: "debit",
    statementType: "balance_sheet",
    postingAllowed: true,
    status: "active",
    createdAt: "2026-03-21T00:00:00.000Z",
    ...overrides,
  });
}

const openFiscal: JournalFiscalContext = {
  companyId: "company-1",
  fiscalYearId: "fy-1405",
  fiscalYearStartDate: "2026-03-21",
  fiscalYearEndDate: "2027-03-20",
  fiscalYearStatus: "open",
  fiscalPeriodId: "period-01",
  fiscalPeriodStartDate: "2026-03-21",
  fiscalPeriodEndDate: "2026-04-20",
  fiscalPeriodStatus: "open",
};

test("accepts active posting subsidiary account in open fiscal context", () => {
  const issues = validateJournalVoucherEligibility({
    companyId: "company-1",
    voucherDate: "2026-04-01",
    account: createPostingAccount(),
    fiscal: openFiscal,
  });

  assert.deepEqual(issues, []);
});

test("rejects cross-company account", () => {
  const issues = validateJournalVoucherEligibility({
    companyId: "company-1",
    voucherDate: "2026-04-01",
    account: createPostingAccount({ companyId: "company-2" }),
    fiscal: openFiscal,
  });

  assert.ok(issues.some((issue) => issue.code === "account_company_mismatch"));
});

test("rejects inactive or non-postable accounts", () => {
  const inactive = validateJournalVoucherEligibility({
    companyId: "company-1",
    voucherDate: "2026-04-01",
    account: createPostingAccount({ status: "inactive" }),
    fiscal: openFiscal,
  });
  assert.ok(inactive.some((issue) => issue.code === "account_inactive"));

  const control = validateJournalVoucherEligibility({
    companyId: "company-1",
    voucherDate: "2026-04-01",
    account: createPostingAccount({ postingAllowed: false }),
    fiscal: openFiscal,
  });
  assert.ok(control.some((issue) => issue.code === "account_not_postable"));
});

test("rejects non-subsidiary account even when otherwise active", () => {
  const issues = validateJournalVoucherEligibility({
    companyId: "company-1",
    voucherDate: "2026-04-01",
    account: createPostingAccount({
      level: "general",
      postingAllowed: false,
      parentId: "group-1",
      code: "1101",
    }),
    fiscal: openFiscal,
  });

  assert.ok(issues.some((issue) => issue.code === "account_not_subsidiary"));
});

test("rejects fiscal context from another company", () => {
  const issues = validateJournalVoucherEligibility({
    companyId: "company-1",
    voucherDate: "2026-04-01",
    account: createPostingAccount(),
    fiscal: { ...openFiscal, companyId: "company-2" },
  });

  assert.ok(issues.some((issue) => issue.code === "fiscal_company_mismatch"));
});

test("rejects non-open fiscal year and period", () => {
  const issues = validateJournalVoucherEligibility({
    companyId: "company-1",
    voucherDate: "2026-04-01",
    account: createPostingAccount(),
    fiscal: {
      ...openFiscal,
      fiscalYearStatus: "closing",
      fiscalPeriodStatus: "locked",
    },
  });

  assert.ok(issues.some((issue) => issue.code === "fiscal_year_not_open"));
  assert.ok(issues.some((issue) => issue.code === "fiscal_period_not_open"));
});

test("rejects voucher date outside fiscal year or period", () => {
  const outsideYear = validateJournalVoucherEligibility({
    companyId: "company-1",
    voucherDate: "2027-03-21",
    account: createPostingAccount(),
    fiscal: openFiscal,
  });
  assert.ok(outsideYear.some((issue) => issue.code === "voucher_date_outside_fiscal_year"));

  const outsidePeriod = validateJournalVoucherEligibility({
    companyId: "company-1",
    voucherDate: "2026-05-01",
    account: createPostingAccount(),
    fiscal: openFiscal,
  });
  assert.ok(outsidePeriod.some((issue) => issue.code === "voucher_date_outside_fiscal_period"));
});

test("assert helper throws aggregated eligibility error", () => {
  assert.throws(
    () => assertJournalVoucherEligibility({
      companyId: "company-1",
      voucherDate: "2026-04-01",
      account: createPostingAccount({ status: "inactive" }),
      fiscal: openFiscal,
    }),
    JournalVoucherEligibilityError,
  );
});
