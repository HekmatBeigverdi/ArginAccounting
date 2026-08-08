import type { AccountDimensionRequirement } from "../domain/account-dimension-policy.ts";
import type { CodingTemplateVersionContent } from "../domain/coding-template-items.ts";
import { validateCodingTemplateGraph } from "../validation/validate-coding-template-graph.ts";

export type CodingTemplatePreviewAction =
  | "create"
  | "compatible_existing"
  | "conflict"
  | "skipped"
  | "invalid";

export type CodingTemplatePreviewItemType =
  | "account"
  | "dimension_type"
  | "dimension_member"
  | "account_dimension_policy";

export type CodingTemplatePreviewIssueCode =
  | "company_scope_conflict"
  | "duplicate_baseline_code"
  | "duplicate_baseline_logical_key"
  | "logical_key_conflict"
  | "code_conflict"
  | "hierarchy_conflict"
  | "classification_conflict"
  | "account_behavior_conflict"
  | "dimension_definition_conflict"
  | "policy_conflict"
  | "reference_conflict"
  | "invalid_template_item";

export interface CodingTemplatePreviewIssue {
  readonly code: CodingTemplatePreviewIssueCode;
  readonly itemType: CodingTemplatePreviewItemType;
  readonly logicalKey: string;
  readonly conflictingId: string | null;
  readonly field: string | null;
}

interface BaselineItem {
  readonly id: string;
  readonly companyId: string;
  readonly logicalKey: string | null;
  readonly code: string;
}

export interface CodingTemplatePreviewAccount extends BaselineItem {
  readonly parentLogicalKey: string | null;
  readonly level: string;
  readonly persianName: string;
  readonly englishName: string | null;
  readonly nature: string;
  readonly normalBalance: string;
  readonly statementType: string;
  readonly reportClassification: unknown;
  readonly postingAllowed: boolean;
  readonly currencyEnabled: boolean;
  readonly revaluationEnabled: boolean;
  readonly trackingEnabled: boolean;
  readonly dueDateEnabled: boolean;
  readonly active: boolean;
  readonly displayOrder: number;
}

export interface CodingTemplatePreviewDimensionType extends BaselineItem {
  readonly persianName: string;
  readonly englishName: string | null;
  readonly hierarchical: boolean;
  readonly allowMultipleMembers: boolean;
  readonly active: boolean;
  readonly displayOrder: number;
}

export interface CodingTemplatePreviewDimensionMember extends BaselineItem {
  readonly dimensionTypeLogicalKey: string;
  readonly parentLogicalKey: string | null;
  readonly persianName: string;
  readonly englishName: string | null;
  readonly active: boolean;
  readonly displayOrder: number;
}

export interface CodingTemplatePreviewPolicy {
  readonly id: string;
  readonly companyId: string;
  readonly accountLogicalKey: string;
  readonly dimensionTypeLogicalKey: string;
  readonly requirement: AccountDimensionRequirement;
}

export interface CodingTemplateCompanyBaseline {
  readonly companyId: string;
  readonly accounts: readonly CodingTemplatePreviewAccount[];
  readonly dimensionTypes: readonly CodingTemplatePreviewDimensionType[];
  readonly dimensionMembers: readonly CodingTemplatePreviewDimensionMember[];
  readonly accountDimensionPolicies: readonly CodingTemplatePreviewPolicy[];
}

export interface CodingTemplatePreviewItem {
  readonly itemType: CodingTemplatePreviewItemType;
  readonly logicalKey: string;
  readonly action: CodingTemplatePreviewAction;
  readonly existingId: string | null;
  readonly issues: readonly CodingTemplatePreviewIssue[];
}

export interface CodingTemplatePreviewSummary {
  readonly create: number;
  readonly compatibleExisting: number;
  readonly conflict: number;
  readonly skipped: number;
  readonly invalid: number;
}

export interface CodingTemplatePreviewPlan {
  readonly companyId: string;
  readonly templateVersionId: string;
  readonly baselineFingerprint: string;
  readonly canApply: boolean;
  readonly items: readonly CodingTemplatePreviewItem[];
  readonly issues: readonly CodingTemplatePreviewIssue[];
  readonly summary: Readonly<CodingTemplatePreviewSummary>;
}

export interface CreateCodingTemplatePreviewInput {
  readonly companyId: string;
  readonly templateVersionId: string;
  readonly content: Readonly<CodingTemplateVersionContent>;
  readonly baseline: Readonly<CodingTemplateCompanyBaseline>;
}

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

const fingerprint = (value: unknown): string => {
  const text = stable(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

const same = (left: unknown, right: unknown): boolean => stable(left) === stable(right);
const key = (item: BaselineItem): string => item.logicalKey ?? "";
const policyKey = (account: string, dimension: string): string => `${account}\u0000${dimension}`;

function issue(code: CodingTemplatePreviewIssueCode, itemType: CodingTemplatePreviewItemType, logicalKey: string, conflictingId: string | null, field: string | null = null): CodingTemplatePreviewIssue {
  return Object.freeze({ code, itemType, logicalKey, conflictingId, field });
}

function duplicates(items: readonly BaselineItem[], selector: (item: BaselineItem) => string): Set<string> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = selector(item);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([value]) => value));
}

export function createCodingTemplatePreview(input: CreateCodingTemplatePreviewInput): Readonly<CodingTemplatePreviewPlan> {
  const { baseline, content } = input;
  const result: CodingTemplatePreviewItem[] = [];
  const graphIssues = validateCodingTemplateGraph(content);
  const allBaseline = [...baseline.accounts, ...baseline.dimensionTypes, ...baseline.dimensionMembers];
  const wrongScope = baseline.companyId !== input.companyId || [...allBaseline, ...baseline.accountDimensionPolicies].some((item) => item.companyId !== input.companyId);

  const plan = <T extends BaselineItem>(itemType: CodingTemplatePreviewItemType, logicalKey: string, code: string, expected: unknown, items: readonly T[], compatible: (existing: T) => boolean, fields: readonly [CodingTemplatePreviewIssueCode, string, (existing: T) => boolean][]) => {
    const byLogical = items.filter((item) => key(item) === logicalKey);
    const byCode = items.filter((item) => item.code === code);
    const existing = byLogical[0] ?? byCode[0] ?? null;
    const issues: CodingTemplatePreviewIssue[] = [];
    if (wrongScope) issues.push(issue("company_scope_conflict", itemType, logicalKey, existing?.id ?? null));
    if (duplicates(items, key).has(logicalKey)) issues.push(issue("duplicate_baseline_logical_key", itemType, logicalKey, existing?.id ?? null));
    if (duplicates(items, (value) => value.code).has(code)) issues.push(issue("duplicate_baseline_code", itemType, logicalKey, existing?.id ?? null));
    if (byLogical.length && byLogical[0]?.code !== code) issues.push(issue("logical_key_conflict", itemType, logicalKey, byLogical[0]?.id ?? null, "code"));
    if (byCode.length && key(byCode[0]!) !== logicalKey) issues.push(issue("code_conflict", itemType, logicalKey, byCode[0]?.id ?? null, "logicalKey"));
    if (existing && !compatible(existing)) {
      for (const [codeValue, field, matches] of fields) if (!matches(existing)) issues.push(issue(codeValue, itemType, logicalKey, existing.id, field));
      if (!issues.length) issues.push(issue("reference_conflict", itemType, logicalKey, existing.id));
    }
    result.push(Object.freeze({ itemType, logicalKey, action: issues.length ? "conflict" : existing ? "compatible_existing" : "create", existingId: existing?.id ?? null, issues: Object.freeze(issues) }));
    void expected;
  };

  for (const account of content.accounts) {
    const expected = { ...account, active: account.activeByDefault };
    plan("account", account.logicalKey, account.code, expected, baseline.accounts, (e) => e.parentLogicalKey === account.parentLogicalKey && e.level === account.level && e.persianName === account.persianName && e.englishName === account.englishName && e.nature === account.nature && e.normalBalance === account.normalBalance && e.statementType === account.statementType && same(e.reportClassification, account.reportClassification) && e.postingAllowed === account.postingAllowed && e.currencyEnabled === account.currencyEnabled && e.revaluationEnabled === account.revaluationEnabled && e.trackingEnabled === account.trackingEnabled && e.dueDateEnabled === account.dueDateEnabled && e.active === account.activeByDefault && e.displayOrder === account.displayOrder, [
      ["hierarchy_conflict", "parentLogicalKey", (e) => e.parentLogicalKey === account.parentLogicalKey && e.level === account.level],
      ["classification_conflict", "reportClassification", (e) => e.statementType === account.statementType && same(e.reportClassification, account.reportClassification)],
      ["account_behavior_conflict", "behavior", (e) => e.nature === account.nature && e.normalBalance === account.normalBalance && e.postingAllowed === account.postingAllowed && e.currencyEnabled === account.currencyEnabled && e.revaluationEnabled === account.revaluationEnabled && e.trackingEnabled === account.trackingEnabled && e.dueDateEnabled === account.dueDateEnabled],
    ]);
  }
  for (const dimension of content.dimensionTypes) {
    plan("dimension_type", dimension.logicalKey, dimension.code, dimension, baseline.dimensionTypes, (e) => e.persianName === dimension.persianName && e.englishName === dimension.englishName && e.hierarchical === dimension.hierarchical && e.allowMultipleMembers === dimension.allowMultipleMembers && e.active === dimension.activeByDefault && e.displayOrder === dimension.displayOrder, [["dimension_definition_conflict", "definition", (e) => e.persianName === dimension.persianName && e.englishName === dimension.englishName && e.hierarchical === dimension.hierarchical && e.allowMultipleMembers === dimension.allowMultipleMembers && e.active === dimension.activeByDefault && e.displayOrder === dimension.displayOrder]]);
  }
  for (const member of content.dimensionMembers) {
    plan("dimension_member", member.logicalKey, member.code, member, baseline.dimensionMembers, (e) => e.dimensionTypeLogicalKey === member.dimensionTypeLogicalKey && e.parentLogicalKey === member.parentLogicalKey && e.persianName === member.persianName && e.englishName === member.englishName && e.active === member.activeByDefault && e.displayOrder === member.displayOrder, [["hierarchy_conflict", "parentLogicalKey", (e) => e.dimensionTypeLogicalKey === member.dimensionTypeLogicalKey && e.parentLogicalKey === member.parentLogicalKey], ["dimension_definition_conflict", "definition", (e) => e.persianName === member.persianName && e.englishName === member.englishName && e.active === member.activeByDefault && e.displayOrder === member.displayOrder]]);
  }

  const policies = new Map(baseline.accountDimensionPolicies.map((value) => [policyKey(value.accountLogicalKey, value.dimensionTypeLogicalKey), value]));
  for (const policy of content.accountDimensionPolicies) {
    const logicalKey = `${policy.accountLogicalKey}:${policy.dimensionTypeLogicalKey}`;
    const existing = policies.get(policyKey(policy.accountLogicalKey, policy.dimensionTypeLogicalKey));
    const issues = wrongScope ? [issue("company_scope_conflict", "account_dimension_policy", logicalKey, existing?.id ?? null)] : existing && existing.requirement !== policy.requirement ? [issue("policy_conflict", "account_dimension_policy", logicalKey, existing.id, "requirement")] : [];
    result.push(Object.freeze({ itemType: "account_dimension_policy", logicalKey, action: issues.length ? "conflict" : existing ? "compatible_existing" : "create", existingId: existing?.id ?? null, issues: Object.freeze(issues) }));
  }

  for (const graphIssue of graphIssues) {
    const logicalKey = graphIssue.itemType === "account_dimension_policy"
      ? result.find((item) => item.itemType === graphIssue.itemType && item.logicalKey.startsWith(`${graphIssue.logicalKey ?? ""}:`))?.logicalKey ?? graphIssue.logicalKey ?? "invalid-policy"
      : graphIssue.logicalKey ?? `invalid-${graphIssue.itemType}`;
    const index = result.findIndex((item) => item.itemType === graphIssue.itemType && item.logicalKey === logicalKey);
    const invalidIssue = issue("invalid_template_item", graphIssue.itemType, logicalKey, null, graphIssue.field);
    if (index >= 0) {
      const current = result[index]!;
      result[index] = Object.freeze({ ...current, action: "invalid", issues: Object.freeze([...current.issues, invalidIssue]) });
    } else {
      result.push(Object.freeze({ itemType: graphIssue.itemType, logicalKey, action: "invalid", existingId: null, issues: Object.freeze([invalidIssue]) }));
    }
  }

  const templateKeys = {
    account: new Set(content.accounts.map((item) => item.logicalKey)),
    dimension_type: new Set(content.dimensionTypes.map((item) => item.logicalKey)),
    dimension_member: new Set(content.dimensionMembers.map((item) => item.logicalKey)),
  } as const;
  for (const [itemType, items] of [["account", baseline.accounts], ["dimension_type", baseline.dimensionTypes], ["dimension_member", baseline.dimensionMembers]] as const) {
    for (const existing of items) {
      if (existing.logicalKey && !templateKeys[itemType].has(existing.logicalKey)) {
        result.push(Object.freeze({ itemType, logicalKey: existing.logicalKey, action: "skipped", existingId: existing.id, issues: Object.freeze([]) }));
      }
    }
  }

  result.sort((a, b) => a.itemType.localeCompare(b.itemType) || a.logicalKey.localeCompare(b.logicalKey));
  const issues = Object.freeze(result.flatMap((item) => item.issues));
  const summary = Object.freeze({
    create: result.filter((item) => item.action === "create").length,
    compatibleExisting: result.filter((item) => item.action === "compatible_existing").length,
    conflict: result.filter((item) => item.action === "conflict").length,
    skipped: result.filter((item) => item.action === "skipped").length,
    invalid: result.filter((item) => item.action === "invalid").length,
  });
  return Object.freeze({ companyId: input.companyId, templateVersionId: input.templateVersionId, baselineFingerprint: fingerprint(baseline), canApply: issues.length === 0, items: Object.freeze(result), issues, summary });
}
