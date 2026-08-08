import assert from "node:assert/strict";
import test from "node:test";

import {
  createCodingTemplatePreview,
  IRAN_SERVICE_CODING_CATALOG,
  type CodingTemplateCompanyBaseline,
  type CodingTemplateVersionContent,
} from "../src/index.ts";

const content = IRAN_SERVICE_CODING_CATALOG.content;

function emptyBaseline(companyId = "company-1"): CodingTemplateCompanyBaseline {
  return { companyId, accounts: [], dimensionTypes: [], dimensionMembers: [], accountDimensionPolicies: [] };
}

function baselineFrom(template: CodingTemplateVersionContent, companyId = "company-1"): CodingTemplateCompanyBaseline {
  return {
    companyId,
    accounts: template.accounts.map((item, index) => ({
      id: `account-${index}`,
      companyId,
      logicalKey: item.logicalKey,
      code: item.code,
      parentLogicalKey: item.parentLogicalKey,
      level: item.level,
      persianName: item.persianName,
      englishName: item.englishName,
      nature: item.nature,
      normalBalance: item.normalBalance,
      statementType: item.statementType,
      reportClassification: item.reportClassification,
      postingAllowed: item.postingAllowed,
      currencyEnabled: item.currencyEnabled,
      revaluationEnabled: item.revaluationEnabled,
      trackingEnabled: item.trackingEnabled,
      dueDateEnabled: item.dueDateEnabled,
      active: item.activeByDefault,
      displayOrder: item.displayOrder,
    })),
    dimensionTypes: template.dimensionTypes.map((item, index) => ({
      id: `dimension-${index}`,
      companyId,
      logicalKey: item.logicalKey,
      code: item.code,
      persianName: item.persianName,
      englishName: item.englishName,
      hierarchical: item.hierarchical,
      allowMultipleMembers: item.allowMultipleMembers,
      active: item.activeByDefault,
      displayOrder: item.displayOrder,
    })),
    dimensionMembers: template.dimensionMembers.map((item, index) => ({
      id: `member-${index}`,
      companyId,
      logicalKey: item.logicalKey,
      code: item.code,
      dimensionTypeLogicalKey: item.dimensionTypeLogicalKey,
      parentLogicalKey: item.parentLogicalKey,
      persianName: item.persianName,
      englishName: item.englishName,
      active: item.activeByDefault,
      displayOrder: item.displayOrder,
    })),
    accountDimensionPolicies: template.accountDimensionPolicies.map((item, index) => ({
      id: `policy-${index}`,
      companyId,
      accountLogicalKey: item.accountLogicalKey,
      dimensionTypeLogicalKey: item.dimensionTypeLogicalKey,
      requirement: item.requirement,
    })),
  };
}

test("preview plans every template item as create for an empty company", () => {
  const preview = createCodingTemplatePreview({ companyId: "company-1", templateVersionId: "version-1", content, baseline: emptyBaseline() });
  const total = content.accounts.length + content.dimensionTypes.length + content.dimensionMembers.length + content.accountDimensionPolicies.length;
  assert.equal(preview.summary.create, total);
  assert.equal(preview.canApply, true);
  assert.equal(preview.issues.length, 0);
});

test("preview recognizes a fully compatible existing company", () => {
  const preview = createCodingTemplatePreview({ companyId: "company-1", templateVersionId: "version-1", content, baseline: baselineFrom(content) });
  assert.equal(preview.summary.create, 0);
  assert.equal(preview.summary.conflict, 0);
  assert.equal(preview.summary.compatibleExisting, preview.items.length);
  assert.equal(preview.canApply, true);
});

test("preview reports hierarchy, classification, behavior, and policy conflicts", () => {
  const baseline = baselineFrom(content);
  const account = baseline.accounts[0]!;
  const policy = baseline.accountDimensionPolicies[0]!;
  const changed: CodingTemplateCompanyBaseline = {
    ...baseline,
    accounts: baseline.accounts.map((item) => item.id === account.id ? { ...item, parentLogicalKey: "wrong-parent", statementType: item.statementType === "balance_sheet" ? "income_statement" : "balance_sheet", currencyEnabled: !item.currencyEnabled } : item),
    accountDimensionPolicies: baseline.accountDimensionPolicies.map((item) => item.id === policy.id ? { ...item, requirement: item.requirement === "required" ? "optional" : "required" } : item),
  };
  const preview = createCodingTemplatePreview({ companyId: "company-1", templateVersionId: "version-1", content, baseline: changed });
  const codes = new Set(preview.issues.map((item) => item.code));
  assert.equal(codes.has("hierarchy_conflict"), true);
  assert.equal(codes.has("classification_conflict"), true);
  assert.equal(codes.has("account_behavior_conflict"), true);
  assert.equal(codes.has("policy_conflict"), true);
  assert.equal(preview.canApply, false);
});

test("preview detects code and logical-key collisions", () => {
  const first = content.accounts[0]!;
  const baseline = emptyBaseline();
  const preview = createCodingTemplatePreview({
    companyId: "company-1",
    templateVersionId: "version-1",
    content,
    baseline: {
      ...baseline,
      accounts: [{
        ...baselineFrom(content).accounts[0]!,
        logicalKey: "unrelated-local-account",
        code: first.code,
      }],
    },
  });
  assert.equal(preview.issues.some((item) => item.code === "code_conflict"), true);
});

test("preview rejects cross-company baseline data", () => {
  const baseline = baselineFrom(content);
  const preview = createCodingTemplatePreview({ companyId: "company-2", templateVersionId: "version-1", content, baseline });
  assert.equal(preview.canApply, false);
  assert.equal(preview.issues.every((item) => item.code === "company_scope_conflict" || item.code.endsWith("conflict")), true);
  assert.equal(preview.issues.some((item) => item.code === "company_scope_conflict"), true);
});

test("preview is deterministic, ordered, and does not mutate its input", () => {
  const baseline = baselineFrom(content);
  const before = JSON.stringify(baseline);
  const first = createCodingTemplatePreview({ companyId: "company-1", templateVersionId: "version-1", content, baseline });
  const second = createCodingTemplatePreview({ companyId: "company-1", templateVersionId: "version-1", content, baseline });
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(baseline), before);
  assert.deepEqual(first.items, [...first.items].sort((a, b) => a.itemType.localeCompare(b.itemType) || a.logicalKey.localeCompare(b.logicalKey)));
});

test("baseline fingerprint changes when operational state changes", () => {
  const baseline = baselineFrom(content);
  const first = createCodingTemplatePreview({ companyId: "company-1", templateVersionId: "version-1", content, baseline });
  const changed = { ...baseline, accounts: baseline.accounts.map((item, index) => index === 0 ? { ...item, active: !item.active } : item) };
  const second = createCodingTemplatePreview({ companyId: "company-1", templateVersionId: "version-1", content, baseline: changed });
  assert.notEqual(first.baselineFingerprint, second.baselineFingerprint);
});

test("preview marks invalid template items and untouched local items explicitly", () => {
  const local = { ...baselineFrom(content).accounts[0]!, id: "local-1", logicalKey: "local-only", code: "999999" };
  const invalidContent: CodingTemplateVersionContent = { ...content, accounts: content.accounts.map((item, index) => index === 0 ? { ...item, persianName: "" } : item) };
  const preview = createCodingTemplatePreview({ companyId: "company-1", templateVersionId: "version-1", content: invalidContent, baseline: { ...emptyBaseline(), accounts: [local] } });
  assert.equal(preview.items.some((item) => item.action === "invalid" && item.issues.some((value) => value.code === "invalid_template_item")), true);
  assert.equal(preview.items.some((item) => item.action === "skipped" && item.logicalKey === "local-only"), true);
  assert.equal(preview.canApply, false);
});
