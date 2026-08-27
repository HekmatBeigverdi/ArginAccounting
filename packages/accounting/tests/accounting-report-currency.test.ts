import assert from "node:assert/strict";
import test from "node:test";

import {
  AccountingReportQueryError,
  normalizeAccountingReportQuery,
} from "../src/reporting.ts";

test("defaults accounting reports to IRR and normalizes explicit currency", () => {
  const defaultQuery = normalizeAccountingReportQuery({
    companyId: "company-1",
    period: { fromDate: "2026-04-01", toDate: "2026-04-30" },
  });
  const usdQuery = normalizeAccountingReportQuery({
    companyId: "company-1",
    currency: " usd ",
    period: { fromDate: "2026-04-01", toDate: "2026-04-30" },
  });

  assert.equal(defaultQuery.currency, "IRR");
  assert.equal(usdQuery.currency, "USD");
});

test("rejects invalid report currency codes", () => {
  assert.throws(
    () => normalizeAccountingReportQuery({
      companyId: "company-1",
      currency: "INVALID-CURRENCY",
      period: { fromDate: "2026-04-01", toDate: "2026-04-30" },
    }),
    (error: unknown) =>
      error instanceof AccountingReportQueryError &&
      error.code === "report.invalid-currency",
  );
});
