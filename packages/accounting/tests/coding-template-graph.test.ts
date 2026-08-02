import assert from "node:assert/strict";
import test from "node:test";

import {
  CodingTemplateGraphValidationError,
  createCodingTemplateVersionContent,
  validateCodingTemplateGraph,
  type CodingTemplateVersionContent,
} from "../src/index.ts";

function validContent(): CodingTemplateVersionContent {
  return {
    accounts: [
      account("assets", null, "group", "1", false),
      account("assets.current", "assets", "general", "11", false),
      account("assets.current.cash", "assets.current", "subsidiary", "1101", true),
    ],
    dimensionTypes: [{
      logicalKey: "dimension.project",
      code: "PROJECT",
      persianName: "پروژه",
      englishName: "Project",
      hierarchical: true,
      allowMultipleMembers: false,
      activeByDefault: true,
      displayOrder: 1,
    }],
    dimensionMembers: [{
      logicalKey: "dimension.project.head-office",
      dimensionTypeLogicalKey: "dimension.project",
      parentLogicalKey: null,
      code: "HEAD-OFFICE",
      persianName: "دفتر مرکزی",
      englishName: "Head office",
      activeByDefault: true,
      displayOrder: 1,
    }],
    accountDimensionPolicies: [{
      accountLogicalKey: "assets.current.cash",
      dimensionTypeLogicalKey: "dimension.project",
      requirement: "optional",
    }],
  };
}

function account(
  logicalKey: string,
  parentLogicalKey: string | null,
  level: "group" | "general" | "subsidiary",
  code: string,
  postingAllowed: boolean,
) {
  return {
    logicalKey,
    parentLogicalKey,
    level,
    code,
    persianName: `حساب ${code}`,
    englishName: null,
    nature: "debit" as const,
    normalBalance: "debit" as const,
    statementType: "balance_sheet" as const,
    reportClassification: {
      balanceSheetSection: "assets" as const,
      incomeStatementSection: null,
      cashFlowCategory: "operating" as const,
      cashEquivalent: false,
      receivable: false,
      payable: false,
      managementTags: ["نقدینگی"],
    },
    postingAllowed,
    currencyEnabled: postingAllowed,
    revaluationEnabled: postingAllowed,
    trackingEnabled: false,
    dueDateEnabled: false,
    activeByDefault: true,
    displayOrder: Number(code),
  };
}

test("validates and freezes a complete company-independent template graph", () => {
  const content = createCodingTemplateVersionContent(validContent());

  assert.deepEqual(validateCodingTemplateGraph(content), []);
  assert.equal(Object.isFrozen(content), true);
  assert.equal(Object.isFrozen(content.accounts), true);
  assert.equal(Object.isFrozen(content.accounts[0]), true);
  assert.equal(Object.isFrozen(content.accounts[0]?.reportClassification), true);
  assert.equal(Object.isFrozen(content.accounts[0]?.reportClassification.managementTags), true);
  assert.equal("companyId" in content.accounts[0]!, false);
});

test("rejects duplicate logical keys and duplicate account codes", () => {
  const content = validContent();
  const duplicate = account("assets.current", "assets", "general", "1", false);
  const issues = validateCodingTemplateGraph({
    ...content,
    accounts: [...content.accounts, duplicate],
  });

  assert.ok(issues.some((issue) => issue.code === "duplicate_logical_key"));
  assert.ok(issues.some((issue) => issue.code === "duplicate_code"));
});

test("rejects missing parents, invalid account levels, and hierarchy cycles", () => {
  const content = validContent();
  const issues = validateCodingTemplateGraph({
    ...content,
    accounts: [
      account("assets", "assets.current", "group", "1", false),
      account("assets.current", "assets.current.cash", "general", "11", false),
      account("assets.current.cash", "assets.current", "subsidiary", "1101", true),
      account("orphan", "missing", "general", "12", false),
    ],
  });

  assert.ok(issues.some((issue) => issue.code === "parent_not_allowed"));
  assert.ok(issues.some((issue) => issue.code === "parent_not_found"));
  assert.ok(issues.some((issue) => issue.code === "parent_level_invalid"));
  assert.ok(issues.some((issue) => issue.code === "hierarchy_cycle"));
});

test("rejects cross-dimension parents and hierarchy on flat dimensions", () => {
  const content = validContent();
  const issues = validateCodingTemplateGraph({
    ...content,
    dimensionTypes: [
      ...content.dimensionTypes,
      {
        ...content.dimensionTypes[0]!,
        logicalKey: "dimension.branch",
        code: "BRANCH",
        hierarchical: false,
      },
    ],
    dimensionMembers: [
      ...content.dimensionMembers,
      {
        ...content.dimensionMembers[0]!,
        logicalKey: "dimension.branch.tehran",
        dimensionTypeLogicalKey: "dimension.branch",
        parentLogicalKey: "dimension.project.head-office",
        code: "TEHRAN",
      },
    ],
  });

  assert.ok(issues.some((issue) => issue.code === "members_not_allowed"));
  assert.ok(issues.some((issue) => issue.code === "parent_dimension_mismatch"));
});

test("rejects missing policy references, duplicate policies, and non-posting accounts", () => {
  const content = validContent();
  const issues = validateCodingTemplateGraph({
    ...content,
    accountDimensionPolicies: [
      {
        accountLogicalKey: "assets.current",
        dimensionTypeLogicalKey: "dimension.project",
        requirement: "required",
      },
      {
        accountLogicalKey: "missing-account",
        dimensionTypeLogicalKey: "missing-dimension",
        requirement: "forbidden",
      },
      ...content.accountDimensionPolicies,
      ...content.accountDimensionPolicies,
    ],
  });

  assert.ok(issues.some((issue) => issue.code === "policy_not_allowed"));
  assert.ok(issues.some((issue) => issue.code === "account_not_found"));
  assert.ok(issues.some((issue) => issue.code === "dimension_type_not_found"));
  assert.ok(issues.some((issue) => issue.code === "duplicate_policy"));
});

test("throws one aggregate error with all graph issues", () => {
  const content = validContent();
  assert.throws(
    () => createCodingTemplateVersionContent({
      ...content,
      accounts: [{ ...content.accounts[0]!, code: "" }],
    }),
    (error: unknown) =>
      error instanceof CodingTemplateGraphValidationError && error.issues.length > 0,
  );
});
