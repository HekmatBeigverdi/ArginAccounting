import assert from "node:assert/strict";
import test from "node:test";

import {
  AccountTreeValidationError,
  assertValidAccountTree,
  createAccount,
  createAccountCodingSettings,
  validateAccountTree,
  type Account,
  type AccountLevel,
} from "../src/index.ts";

const CREATED_AT = "2026-07-29T08:30:00.000Z";

const SETTINGS = createAccountCodingSettings({
  companyId: "company-1",
});

function account(
  level: AccountLevel,
  code: string,
  parentId: string | null,
  overrides: Partial<Account> = {},
): Account {
  return createAccount({
    id: `${level}-${code}`,
    companyId: "company-1",
    parentId,
    level,
    code,
    name: `حساب ${code}`,
    nature: "debit",
    normalBalance: "debit",
    statementType: "balance_sheet",
    postingAllowed: level === "subsidiary",
    createdAt: CREATED_AT,
    ...overrides,
  });
}

test("accepts a complete group, general and subsidiary hierarchy", () => {
  const group = account("group", "11", null);
  const general = account("general", "1101", group.id);
  const subsidiary = account(
    "subsidiary",
    "110101",
    general.id,
  );

  assert.deepEqual(
    validateAccountTree(group, null, SETTINGS),
    [],
  );
  assert.deepEqual(
    validateAccountTree(general, group, SETTINGS),
    [],
  );
  assert.doesNotThrow(() =>
    assertValidAccountTree(
      subsidiary,
      general,
      SETTINGS,
    ),
  );
});

test("rejects a parent for a group account", () => {
  const parent = account("group", "10", null);
  const group = account("group", "11", parent.id);

  const issues = validateAccountTree(
    group,
    parent,
    SETTINGS,
  );

  assert.ok(
    issues.some((issue) => issue.field === "parentId"),
  );
});

test("requires a resolved parent for general and subsidiary accounts", () => {
  for (const child of [
    account("general", "1101", null),
    account("subsidiary", "110101", null),
  ]) {
    assert.throws(
      () => assertValidAccountTree(child, null, SETTINGS),
      AccountTreeValidationError,
    );
  }
});

test("requires the supplied parent to match parentId", () => {
  const group = account("group", "11", null);
  const general = account(
    "general",
    "1101",
    "another-group",
  );

  const issues = validateAccountTree(
    general,
    group,
    SETTINGS,
  );

  assert.ok(
    issues.some(
      (issue) =>
        issue.field === "parentId" &&
        issue.message.includes("یکسان نیست"),
    ),
  );
});

test("enforces group as the general parent and general as the subsidiary parent", () => {
  const group = account("group", "11", null);
  const general = account("general", "1101", group.id);
  const invalidGeneral = account(
    "general",
    "1102",
    general.id,
  );
  const invalidSubsidiary = account(
    "subsidiary",
    "110101",
    group.id,
  );

  assert.ok(
    validateAccountTree(
      invalidGeneral,
      general,
      SETTINGS,
    ).some((issue) => issue.field === "level"),
  );
  assert.ok(
    validateAccountTree(
      invalidSubsidiary,
      group,
      SETTINGS,
    ).some((issue) => issue.field === "level"),
  );
});

test("prevents parent-child relationships across companies", () => {
  const foreignGroup = account(
    "group",
    "11",
    null,
    {
      id: "foreign-group",
      companyId: "company-2",
    },
  );
  const general = account(
    "general",
    "1101",
    foreignGroup.id,
  );

  const issues = validateAccountTree(
    general,
    foreignGroup,
    SETTINGS,
  );

  assert.ok(
    issues.some((issue) => issue.field === "companyId"),
  );
});

test("enforces the configured code length for every level", () => {
  const customSettings = createAccountCodingSettings({
    companyId: "company-1",
    groupCodeLength: 3,
    generalCodeLength: 5,
    subsidiaryCodeLength: 8,
  });
  const group = account("group", "11", null);

  const issues = validateAccountTree(
    group,
    null,
    customSettings,
  );

  assert.deepEqual(
    issues.map((issue) => issue.field),
    ["code"],
  );
  assert.match(issues[0]?.message ?? "", /3/);
});

test("requires a child code to start with its parent code in hierarchical mode", () => {
  const group = account("group", "11", null);
  const general = account("general", "1201", group.id);

  const issues = validateAccountTree(
    general,
    group,
    SETTINGS,
  );

  assert.ok(
    issues.some(
      (issue) =>
        issue.field === "code" &&
        issue.message.includes("کد والد"),
    ),
  );
});

test("allows independent codes when hierarchical enforcement is disabled", () => {
  const settings = createAccountCodingSettings({
    companyId: "company-1",
    enforceHierarchicalCodes: false,
  });
  const group = account("group", "11", null);
  const general = account("general", "1201", group.id);

  assert.deepEqual(
    validateAccountTree(general, group, settings),
    [],
  );
});

test("requires settings to belong to the account company", () => {
  const foreignSettings = createAccountCodingSettings({
    companyId: "company-2",
  });
  const group = account("group", "11", null);

  const issues = validateAccountTree(
    group,
    null,
    foreignSettings,
  );

  assert.ok(
    issues.some(
      (issue) =>
        issue.field === "companyId" &&
        issue.message.includes("تنظیمات کدینگ"),
    ),
  );
});
