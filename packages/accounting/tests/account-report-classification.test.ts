import assert from "node:assert/strict";
import test from "node:test";

import {
  AccountReportClassificationValidationError,
  createAccount,
  createAccountReportClassification,
} from "../src/index.ts";

test("creates an immutable explicit report classification", () => {
  const classification =
    createAccountReportClassification(
      {
        balanceSheetSection: "assets",
        cashFlowCategory:
          "cash_and_cash_equivalents",
        cashEquivalent: true,
        receivable: true,
        managementTags: [
          "  سرمایه در گردش ",
          "نقدینگی\tروزانه",
        ],
      },
      { statementType: "balance_sheet" },
    );

  assert.deepEqual(classification, {
    balanceSheetSection: "assets",
    incomeStatementSection: null,
    cashFlowCategory: "cash_and_cash_equivalents",
    cashEquivalent: true,
    receivable: true,
    payable: false,
    managementTags: [
      "سرمایه در گردش",
      "نقدینگی روزانه",
    ],
  });
  assert.equal(Object.isFrozen(classification), true);
  assert.equal(
    Object.isFrozen(classification.managementTags),
    true,
  );
});

test("provides an empty safe classification by default", () => {
  const classification =
    createAccountReportClassification(
      {},
      { statementType: "memorandum" },
    );

  assert.deepEqual(classification, {
    balanceSheetSection: null,
    incomeStatementSection: null,
    cashFlowCategory: null,
    cashEquivalent: false,
    receivable: false,
    payable: false,
    managementTags: [],
  });
});

test("keeps classification independent from account code", () => {
  const first = createAccountReportClassification(
    {
      balanceSheetSection: "assets",
      managementTags: ["دارایی جاری"],
    },
    { statementType: "balance_sheet" },
  );
  const second = createAccountReportClassification(
    {
      balanceSheetSection: "assets",
      managementTags: ["دارایی جاری"],
    },
    { statementType: "balance_sheet" },
  );

  assert.deepEqual(first, second);
});

test("rejects a balance-sheet section on other statements", () => {
  assert.throws(
    () =>
      createAccountReportClassification(
        { balanceSheetSection: "assets" },
        { statementType: "income_statement" },
      ),
    AccountReportClassificationValidationError,
  );
});

test("rejects an income-statement section on other statements", () => {
  assert.throws(
    () =>
      createAccountReportClassification(
        { incomeStatementSection: "revenue" },
        { statementType: "balance_sheet" },
      ),
    AccountReportClassificationValidationError,
  );
});

test("rejects financial flags for memorandum accounts", () => {
  assert.throws(
    () =>
      createAccountReportClassification(
        {
          cashEquivalent: true,
          receivable: true,
        },
        { statementType: "memorandum" },
      ),
    (error: unknown) => {
      assert.ok(
        error instanceof
          AccountReportClassificationValidationError,
      );
      assert.deepEqual(
        error.issues.map((issue) => issue.field),
        ["cashEquivalent", "receivable"],
      );
      return true;
    },
  );
});

test("rejects simultaneous receivable and payable flags", () => {
  assert.throws(
    () =>
      createAccountReportClassification(
        { receivable: true, payable: true },
        { statementType: "balance_sheet" },
      ),
    AccountReportClassificationValidationError,
  );
});

test("rejects empty, long, and duplicate management tags", () => {
  assert.throws(
    () =>
      createAccountReportClassification(
        {
          managementTags: [
            " ",
            "a".repeat(101),
            "نقدینگی",
            "نقدینگی",
          ],
        },
        { statementType: "balance_sheet" },
      ),
    (error: unknown) => {
      assert.ok(
        error instanceof
          AccountReportClassificationValidationError,
      );
      assert.deepEqual(
        error.issues.map((issue) => issue.field),
        [
          "managementTags",
          "managementTags",
          "managementTags",
        ],
      );
      return true;
    },
  );
});

test("createAccount attaches and normalizes report classification", () => {
  const account = createAccount({
    id: "account-1",
    companyId: "company-1",
    parentId: "general-1",
    level: "subsidiary",
    code: "110101",
    name: "بانک",
    nature: "strict_debit",
    normalBalance: "debit",
    statementType: "balance_sheet",
    reportClassification: {
      balanceSheetSection: "assets",
      cashEquivalent: true,
      managementTags: [" نقدینگی "],
    },
    postingAllowed: true,
    createdAt: "2026-07-29T08:30:00.000Z",
  });

  assert.equal(
    account.reportClassification.balanceSheetSection,
    "assets",
  );
  assert.equal(
    account.reportClassification.cashEquivalent,
    true,
  );
  assert.deepEqual(
    account.reportClassification.managementTags,
    ["نقدینگی"],
  );
});
