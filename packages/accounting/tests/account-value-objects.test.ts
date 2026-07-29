import assert from "node:assert/strict";
import test from "node:test";

import {
  AccountCodeValidationError,
  AccountNameValidationError,
  createAccountCode,
  createAccountName,
  normalizeAccountCodeDigits,
} from "../src/index.ts";

test("normalizes Persian and Arabic digits to English digits", () => {
  assert.equal(
    normalizeAccountCodeDigits("۱۲۳٤٥٦789"),
    "123456789",
  );
  assert.equal(createAccountCode(" ۱۱۰١٠١ "), "110101");
});

test("accepts numeric account codes from 1 to 30 digits", () => {
  assert.equal(createAccountCode("1"), "1");
  assert.equal(createAccountCode("1".repeat(30)), "1".repeat(30));
});

test("rejects empty and overlong account codes", () => {
  assert.throws(
    () => createAccountCode(" "),
    AccountCodeValidationError,
  );
  assert.throws(
    () => createAccountCode("1".repeat(31)),
    AccountCodeValidationError,
  );
});

test("rejects signs, separators, letters and embedded whitespace", () => {
  for (const invalidCode of [
    "-1101",
    "11.01",
    "11/01",
    "11A01",
    "11 01",
  ]) {
    assert.throws(
      () => createAccountCode(invalidCode),
      AccountCodeValidationError,
    );
  }
});

test("normalizes surrounding and repeated whitespace in account names", () => {
  assert.equal(
    createAccountName("  موجودی\tنقد\nو بانک  "),
    "موجودی نقد و بانک",
  );
});

test("preserves Persian account names and internal punctuation", () => {
  assert.equal(
    createAccountName("حساب‌های دریافتنی - تجاری"),
    "حساب‌های دریافتنی - تجاری",
  );
});

test("rejects empty and overlong account names", () => {
  assert.throws(
    () => createAccountName(" \t "),
    AccountNameValidationError,
  );
  assert.throws(
    () => createAccountName("آ".repeat(201)),
    AccountNameValidationError,
  );
});

test("creates accounts with normalized code and name value objects", async () => {
  const { createAccount } = await import("../src/index.ts");
  const account = createAccount({
    id: "account-1",
    companyId: "company-1",
    parentId: "general-1",
    level: "subsidiary",
    code: " ۱۱۰١٠١ ",
    name: "  موجودی   نقد ",
    nature: "strict_debit",
    normalBalance: "debit",
    statementType: "balance_sheet",
    postingAllowed: true,
    createdAt: "2026-07-29T08:30:00.000Z",
  });

  assert.equal(account.code, "110101");
  assert.equal(account.name, "موجودی نقد");
});
