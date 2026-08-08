import assert from "node:assert/strict";
import test from "node:test";

import {
  createCodingTemplateUpgradePlan,
  IRAN_SERVICE_CODING_CATALOG,
  type CodingTemplateApplicationItemMapping,
  type CodingTemplateCompanyBaseline,
  type CodingTemplateVersionContent,
} from "../src/index.ts";

const companyId = "company-1";
const original = IRAN_SERVICE_CODING_CATALOG.content;

function baselineFrom(content: CodingTemplateVersionContent): CodingTemplateCompanyBaseline {
  return {
    companyId,
    accounts: content.accounts.map((item, index) => ({ id: `account-${index}`, companyId, logicalKey: item.logicalKey, code: item.code, parentLogicalKey: item.parentLogicalKey, level: item.level, persianName: item.persianName, englishName: item.englishName, nature: item.nature, normalBalance: item.normalBalance, statementType: item.statementType, reportClassification: item.reportClassification, postingAllowed: item.postingAllowed, currencyEnabled: item.currencyEnabled, revaluationEnabled: item.revaluationEnabled, trackingEnabled: item.trackingEnabled, dueDateEnabled: item.dueDateEnabled, active: item.activeByDefault, displayOrder: item.displayOrder })),
    dimensionTypes: content.dimensionTypes.map((item, index) => ({ id: `type-${index}`, companyId, logicalKey: item.logicalKey, code: item.code, persianName: item.persianName, englishName: item.englishName, hierarchical: item.hierarchical, allowMultipleMembers: item.allowMultipleMembers, active: item.activeByDefault, displayOrder: item.displayOrder })),
    dimensionMembers: content.dimensionMembers.map((item, index) => ({ id: `member-${index}`, companyId, logicalKey: item.logicalKey, code: item.code, dimensionTypeLogicalKey: item.dimensionTypeLogicalKey, parentLogicalKey: item.parentLogicalKey, persianName: item.persianName, englishName: item.englishName, active: item.activeByDefault, displayOrder: item.displayOrder })),
    accountDimensionPolicies: content.accountDimensionPolicies.map((item, index) => ({ id: `policy-${index}`, companyId, accountLogicalKey: item.accountLogicalKey, dimensionTypeLogicalKey: item.dimensionTypeLogicalKey, requirement: item.requirement })),
  };
}

function mappings(baseline: CodingTemplateCompanyBaseline): CodingTemplateApplicationItemMapping[] {
  return [
    ...baseline.accounts.map((item) => ({ itemType: "account" as const, logicalKey: item.logicalKey!, operationalId: item.id })),
    ...baseline.dimensionTypes.map((item) => ({ itemType: "dimension_type" as const, logicalKey: item.logicalKey!, operationalId: item.id })),
    ...baseline.dimensionMembers.map((item) => ({ itemType: "dimension_member" as const, logicalKey: item.logicalKey!, operationalId: item.id })),
    ...baseline.accountDimensionPolicies.map((item) => ({ itemType: "account_dimension_policy" as const, logicalKey: `${item.accountLogicalKey}:${item.dimensionTypeLogicalKey}`, operationalId: item.id })),
  ].map((item) => ({ ...item, applicationId: "application-1", companyId, templateVersionId: "version-1", action: "created" as const }));
}

function plan(toContent: CodingTemplateVersionContent, baseline = baselineFrom(original), decisions?: Readonly<Record<string, "accept" | "skip">>) {
  return createCodingTemplateUpgradePlan({ companyId, templateId: "template-1", fromVersionId: "version-1", fromVersionNumber: 1, fromContent: original, toTemplateId: "template-1", toVersionId: "version-2", toVersionNumber: 2, toContent, baseline, appliedMappings: mappings(baselineFrom(original)), ...(decisions ? { decisions } : {}) });
}

test("classifies an identical newer version as unchanged and deterministic", () => {
  const first = plan(original);
  const second = plan(original);
  assert.deepEqual(first, second);
  assert.equal(first.summary.unchanged, first.items.length);
  assert.equal(first.canApply, true);
});

test("requires explicit acceptance for additive template items and records skip", () => {
  const added = { ...original.accounts[0]!, logicalKey: "asset.new", code: "199999", persianName: "حساب جدید" };
  const target = { ...original, accounts: [...original.accounts, added] };
  const implicit = plan(target);
  const key = "account:asset.new";
  const accepted = plan(target, baselineFrom(original), { [key]: "accept" });
  assert.equal(implicit.items.find((item) => item.logicalKey === added.logicalKey)?.action, "none");
  assert.equal(implicit.summary.skipped, 1);
  assert.equal(accepted.items.find((item) => item.logicalKey === added.logicalKey)?.action, "add");
  assert.equal(accepted.summary.accepted, 1);
});

test("permits an explicit safe template update when the company item is unchanged", () => {
  const changed = { ...original.accounts[0]!, persianName: `${original.accounts[0]!.persianName} جدید` };
  const target = { ...original, accounts: original.accounts.map((item, index) => index === 0 ? changed : item) };
  const result = plan(target, baselineFrom(original), { [`account:${changed.logicalKey}`]: "accept" });
  const item = result.items.find((value) => value.logicalKey === changed.logicalKey)!;
  assert.equal(item.status, "unchanged");
  assert.equal(item.templateChanged, true);
  assert.equal(item.action, "upgrade");
});

test("preserves local customization when only the company changed", () => {
  const baseline = baselineFrom(original);
  const changed = { ...baseline.accounts[0]!, persianName: "نام سفارشی شرکت" };
  const result = plan(original, { ...baseline, accounts: baseline.accounts.map((item, index) => index === 0 ? changed : item) });
  const item = result.items.find((value) => value.logicalKey === changed.logicalKey)!;
  assert.equal(item.status, "locally_modified");
  assert.equal(item.action, "preserve_local");
  assert.equal(result.canApply, true);
});

test("requires resolution when local and template changes diverge", () => {
  const baseline = baselineFrom(original);
  const local = { ...baseline.accounts[0]!, persianName: "نام محلی" };
  const targetItem = { ...original.accounts[0]!, persianName: "نام نسخه جدید" };
  const target = { ...original, accounts: original.accounts.map((item, index) => index === 0 ? targetItem : item) };
  const result = plan(target, { ...baseline, accounts: baseline.accounts.map((item, index) => index === 0 ? local : item) });
  const item = result.items.find((value) => value.logicalKey === local.logicalKey)!;
  assert.equal(item.status, "conflicting");
  assert.equal(item.action, "requires_resolution");
  assert.equal(result.canApply, false);
});

test("retired template items are always preserved operationally", () => {
  const retired = original.accounts.at(-1)!;
  const target = { ...original, accounts: original.accounts.slice(0, -1), accountDimensionPolicies: original.accountDimensionPolicies.filter((item) => item.accountLogicalKey !== retired.logicalKey) };
  const result = plan(target);
  const item = result.items.find((value) => value.itemType === "account" && value.logicalKey === retired.logicalKey)!;
  assert.equal(item.status, "retired");
  assert.equal(item.action, "preserve_retired");
});

test("rejects cross-template, backward-version, and broken mapping upgrades", () => {
  const baseline = baselineFrom(original);
  const broken = mappings(baseline).slice(1);
  const result = createCodingTemplateUpgradePlan({ companyId, templateId: "template-1", fromVersionId: "version-1", fromVersionNumber: 2, fromContent: original, toTemplateId: "other-template", toVersionId: "version-1", toVersionNumber: 1, toContent: original, baseline, appliedMappings: broken });
  const codes = new Set(result.issues.map((item) => item.code));
  assert.equal(codes.has("template_identity_conflict"), true);
  assert.equal(codes.has("version_order_conflict"), true);
  assert.equal(codes.has("mapping_missing"), true);
  assert.equal(result.canApply, false);
});

test("does not mutate any upgrade input", () => {
  const baseline = baselineFrom(original);
  const before = JSON.stringify({ original, baseline });
  plan(original, baseline);
  assert.equal(JSON.stringify({ original, baseline }), before);
});
