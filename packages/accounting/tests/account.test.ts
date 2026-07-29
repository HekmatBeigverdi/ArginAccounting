import assert from "node:assert/strict";
import test from "node:test";

import {
  AccountValidationError,
  createAccount,
  type CreateAccountInput,
} from "../src/index.ts";

const VALID_INPUT: CreateAccountInput = {
  id: "account-1",
  companyId: "company-1",
  parentId: "general-1",
  level: "subsidiary",
  code: "110101",
  name: "موجودی نقد",
  englishName: "Cash on hand",
  nature: "strict_debit",
  normalBalance: "debit",
  statementType: "balance_sheet",
  postingAllowed: true,
  currencyEnabled: false,
  revaluationEnabled: false,
  trackingEnabled: true,
  dueDateEnabled: false,
  status: "active",
  displayOrder: 10,
  sourceType: "manual",
  sourceReferenceId: null,
  createdAt: "2026-07-29T08:30:00.000Z",
};

test("creates an immutable account with initial version", () => {
  const account = createAccount(VALID_INPUT);

  assert.deepEqual(account, {
    ...VALID_INPUT,
    parentId: "general-1",
    englishName: "Cash on hand",
    status: "active",
    sourceType: "manual",
    sourceReferenceId: null,
    createdAt: VALID_INPUT.createdAt,
    updatedAt: VALID_INPUT.createdAt,
    version: 1,
  });
  assert.equal(Object.isFrozen(account), true);
});

test("trims textual values and converts empty optional values to null", () => {
  const account = createAccount({
    ...VALID_INPUT,
    id: " account-1 ",
    companyId: " company-1 ",
    parentId: " ",
    code: " 110101 ",
    name: " موجودی نقد ",
    englishName: " ",
    sourceReferenceId: " ",
    createdAt: " 2026-07-29T08:30:00.000Z ",
  });

  assert.equal(account.id, "account-1");
  assert.equal(account.companyId, "company-1");
  assert.equal(account.parentId, null);
  assert.equal(account.code, "110101");
  assert.equal(account.name, "موجودی نقد");
  assert.equal(account.englishName, null);
  assert.equal(account.sourceReferenceId, null);
});

test("applies safe defaults for optional account behavior", () => {
  const account = createAccount({
    id: "group-1",
    companyId: "company-1",
    level: "group",
    code: "11",
    name: "دارایی‌ها",
    nature: "debit",
    normalBalance: "debit",
    statementType: "balance_sheet",
    createdAt: VALID_INPUT.createdAt,
  });

  assert.equal(account.parentId, null);
  assert.equal(account.postingAllowed, false);
  assert.equal(account.currencyEnabled, false);
  assert.equal(account.revaluationEnabled, false);
  assert.equal(account.trackingEnabled, false);
  assert.equal(account.dueDateEnabled, false);
  assert.equal(account.status, "active");
  assert.equal(account.displayOrder, 0);
  assert.equal(account.sourceType, "manual");
});

test("preserves template and Excel import provenance", () => {
  const templateAccount = createAccount({
    ...VALID_INPUT,
    sourceType: "coding_template",
    sourceReferenceId: "template-service-v1",
  });
  const importedAccount = createAccount({
    ...VALID_INPUT,
    id: "account-2",
    sourceType: "excel_import",
    sourceReferenceId: "import-batch-10",
  });

  assert.equal(templateAccount.sourceType, "coding_template");
  assert.equal(
    templateAccount.sourceReferenceId,
    "template-service-v1",
  );
  assert.equal(importedAccount.sourceType, "excel_import");
  assert.equal(
    importedAccount.sourceReferenceId,
    "import-batch-10",
  );
});

test("rejects required identifiers, code, name and timestamp when empty", () => {
  assert.throws(
    () =>
      createAccount({
        ...VALID_INPUT,
        id: " ",
        companyId: "",
        code: " ",
        name: "",
        createdAt: " ",
      }),
    (error: unknown) => {
      assert.ok(error instanceof AccountValidationError);
      assert.deepEqual(
        error.issues.map((issue) => issue.field),
        [
          "id",
          "companyId",
          "code",
          "name",
          "createdAt",
          "updatedAt",
        ],
      );
      return true;
    },
  );
});

test("rejects a self-referencing parent", () => {
  assert.throws(
    () =>
      createAccount({
        ...VALID_INPUT,
        id: "account-1",
        parentId: "account-1",
      }),
    AccountValidationError,
  );
});

test("only subsidiary accounts can accept postings", () => {
  assert.throws(
    () =>
      createAccount({
        ...VALID_INPUT,
        level: "general",
        postingAllowed: true,
      }),
    AccountValidationError,
  );
});

test("revaluation requires currency support", () => {
  assert.throws(
    () =>
      createAccount({
        ...VALID_INPUT,
        currencyEnabled: false,
        revaluationEnabled: true,
      }),
    AccountValidationError,
  );
});

test("display order must be a non-negative safe integer", () => {
  assert.throws(
    () =>
      createAccount({
        ...VALID_INPUT,
        displayOrder: -1,
      }),
    AccountValidationError,
  );
});
