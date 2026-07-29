import assert from "node:assert/strict";
import test from "node:test";

import {
  AccountCodingSettingsValidationError,
  createAccountCodingSettings,
  validateAccountCodingSettings,
  type AccountCodingSettings,
} from "../src/index.ts";

test("creates safe default coding settings for a company", () => {
  const settings = createAccountCodingSettings({
    companyId: " company-1 ",
  });

  assert.deepEqual(settings, {
    companyId: "company-1",
    groupCodeLength: 2,
    generalCodeLength: 4,
    subsidiaryCodeLength: 6,
    enforceHierarchicalCodes: true,
    allowCodeChangeAfterUse: false,
    version: 1,
  });
  assert.equal(Object.isFrozen(settings), true);
});

test("accepts company-specific code lengths", () => {
  const settings = createAccountCodingSettings({
    companyId: "company-1",
    groupCodeLength: 1,
    generalCodeLength: 3,
    subsidiaryCodeLength: 7,
    enforceHierarchicalCodes: true,
    allowCodeChangeAfterUse: true,
  });

  assert.equal(settings.groupCodeLength, 1);
  assert.equal(settings.generalCodeLength, 3);
  assert.equal(settings.subsidiaryCodeLength, 7);
  assert.equal(settings.allowCodeChangeAfterUse, true);
});

test("rejects an empty company identifier", () => {
  assert.throws(
    () =>
      createAccountCodingSettings({
        companyId: "   ",
      }),
    (error: unknown) => {
      assert.ok(
        error instanceof
          AccountCodingSettingsValidationError,
      );
      assert.equal(error.issues[0]?.field, "companyId");
      return true;
    },
  );
});

test("rejects non-integer and out-of-range lengths", () => {
  const invalidSettings: AccountCodingSettings = {
    companyId: "company-1",
    groupCodeLength: 0,
    generalCodeLength: 4.5,
    subsidiaryCodeLength: 31,
    enforceHierarchicalCodes: false,
    allowCodeChangeAfterUse: false,
    version: 1,
  };

  const issues =
    validateAccountCodingSettings(invalidSettings);

  assert.deepEqual(
    issues.map((issue) => issue.field),
    [
      "groupCodeLength",
      "generalCodeLength",
      "subsidiaryCodeLength",
    ],
  );
});

test("hierarchical lengths must increase by account level", () => {
  assert.throws(
    () =>
      createAccountCodingSettings({
        companyId: "company-1",
        groupCodeLength: 4,
        generalCodeLength: 4,
        subsidiaryCodeLength: 6,
      }),
    AccountCodingSettingsValidationError,
  );
});

test("non-hierarchical coding permits independent valid lengths", () => {
  const settings = createAccountCodingSettings({
    companyId: "company-1",
    groupCodeLength: 4,
    generalCodeLength: 4,
    subsidiaryCodeLength: 4,
    enforceHierarchicalCodes: false,
  });

  assert.equal(settings.groupCodeLength, 4);
  assert.equal(settings.generalCodeLength, 4);
  assert.equal(settings.subsidiaryCodeLength, 4);
});

test("rejects an invalid optimistic concurrency version", () => {
  const issues = validateAccountCodingSettings({
    companyId: "company-1",
    groupCodeLength: 2,
    generalCodeLength: 4,
    subsidiaryCodeLength: 6,
    enforceHierarchicalCodes: true,
    allowCodeChangeAfterUse: false,
    version: 0,
  });

  assert.deepEqual(
    issues.map((issue) => issue.field),
    ["version"],
  );
});
