import assert from "node:assert/strict";
import test from "node:test";

import {
  type Account,
  type AccountTreeNode,
  createAccountCode,
  createAccountName
} from "@argin/accounting";
import {
  flattenAccountTree,
  getAccountingErrorMessage
} from "../src/features/accounting/chart-of-accounts-presenter.ts";

function createAccount(
  id: string,
  parentId: string | null,
  level: Account["level"]
): Account {
  return {
    id,
    companyId: "company-1",
    parentId,
    level,
    code: createAccountCode(id),
    name: createAccountName(id),
    englishName: null,
    nature: "uncontrolled",
    normalBalance: "debit",
    statementType: "balance_sheet",
    reportClassification: {
      balanceSheetSection: "assets",
      incomeStatementSection: null,
      cashFlowCategory: null,
      cashEquivalent: false,
      receivable: false,
      payable: false,
      managementTags: []
    },
    postingAllowed: level === "subsidiary",
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
    version: 1
  };
}

test("flattens account tree in parent-first order", () => {
  const subsidiary = createAccount("110101", "1101", "subsidiary");
  const general = createAccount("1101", "11", "general");
  const group = createAccount("11", null, "group");
  const tree: readonly AccountTreeNode[] = [{
    account: group,
    children: [{
      account: general,
      children: [{ account: subsidiary, children: [] }]
    }]
  }];

  assert.deepEqual(
    flattenAccountTree(tree).map(({ account, depth }) => [
      account.id,
      depth
    ]),
    [["11", 0], ["1101", 1], ["110101", 2]]
  );
});

test("maps stable accounting errors to Persian messages", () => {
  assert.equal(
    getAccountingErrorMessage({ code: "VERSION_MISMATCH" }),
    "اطلاعات توسط کاربر دیگری تغییر کرده است؛ فهرست را تازه‌سازی کنید."
  );
  assert.equal(
    getAccountingErrorMessage({ code: "ACCOUNT_HAS_CHILDREN" }),
    "حساب دارای زیرمجموعه را نمی‌توان حذف کرد."
  );
});
