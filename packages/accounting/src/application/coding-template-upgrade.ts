import type { CodingTemplateApplicationItemMapping, CodingTemplateApplicationItemType } from "../contracts/coding-template-records.ts";
import type { CodingTemplateVersionContent } from "../domain/coding-template-items.ts";
import type { CodingTemplateCompanyBaseline } from "./coding-template-preview.ts";

export type CodingTemplateUpgradeStatus =
  | "unchanged"
  | "locally_modified"
  | "newly_available"
  | "conflicting"
  | "retired";

export type CodingTemplateUpgradeDecision = "accept" | "skip";

export type CodingTemplateUpgradeAction =
  | "none"
  | "add"
  | "upgrade"
  | "preserve_local"
  | "preserve_retired"
  | "requires_resolution";

export type CodingTemplateUpgradeIssueCode =
  | "company_scope_conflict"
  | "template_identity_conflict"
  | "version_order_conflict"
  | "mapping_missing"
  | "mapping_identity_conflict"
  | "local_item_missing"
  | "local_change_conflict"
  | "invalid_upgrade_decision";

export interface CodingTemplateUpgradeIssue {
  readonly code: CodingTemplateUpgradeIssueCode;
  readonly itemType: CodingTemplateApplicationItemType | null;
  readonly logicalKey: string | null;
  readonly operationalId: string | null;
}

export interface CodingTemplateUpgradeItem {
  readonly itemType: CodingTemplateApplicationItemType;
  readonly logicalKey: string;
  readonly operationalId: string | null;
  readonly status: CodingTemplateUpgradeStatus;
  readonly decision: CodingTemplateUpgradeDecision | null;
  readonly action: CodingTemplateUpgradeAction;
  readonly templateChanged: boolean;
  readonly localChanged: boolean;
  readonly issues: readonly CodingTemplateUpgradeIssue[];
}

export interface CodingTemplateUpgradeSummary {
  readonly unchanged: number;
  readonly locallyModified: number;
  readonly newlyAvailable: number;
  readonly conflicting: number;
  readonly retired: number;
  readonly accepted: number;
  readonly skipped: number;
}

export interface CodingTemplateUpgradePlan {
  readonly companyId: string;
  readonly templateId: string;
  readonly fromVersionId: string;
  readonly fromVersionNumber: number;
  readonly toVersionId: string;
  readonly toVersionNumber: number;
  readonly canApply: boolean;
  readonly items: readonly CodingTemplateUpgradeItem[];
  readonly issues: readonly CodingTemplateUpgradeIssue[];
  readonly summary: Readonly<CodingTemplateUpgradeSummary>;
}

export interface CreateCodingTemplateUpgradePlanInput {
  readonly companyId: string;
  readonly templateId: string;
  readonly fromVersionId: string;
  readonly fromVersionNumber: number;
  readonly fromContent: Readonly<CodingTemplateVersionContent>;
  readonly toTemplateId: string;
  readonly toVersionId: string;
  readonly toVersionNumber: number;
  readonly toContent: Readonly<CodingTemplateVersionContent>;
  readonly baseline: Readonly<CodingTemplateCompanyBaseline>;
  readonly appliedMappings: readonly CodingTemplateApplicationItemMapping[];
  readonly decisions?: Readonly<Record<string, CodingTemplateUpgradeDecision>>;
}

interface ItemSnapshot {
  readonly itemType: CodingTemplateApplicationItemType;
  readonly logicalKey: string;
  readonly value: unknown;
}

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

const same = (left: unknown, right: unknown): boolean => stable(left) === stable(right);
const itemKey = (itemType: CodingTemplateApplicationItemType, logicalKey: string): string => `${itemType}:${logicalKey}`;
const policyLogicalKey = (account: string, dimension: string): string => `${account}:${dimension}`;

function contentItems(content: Readonly<CodingTemplateVersionContent>): readonly ItemSnapshot[] {
  return [
    ...content.accounts.map((item) => ({ itemType: "account" as const, logicalKey: item.logicalKey, value: item })),
    ...content.dimensionTypes.map((item) => ({ itemType: "dimension_type" as const, logicalKey: item.logicalKey, value: item })),
    ...content.dimensionMembers.map((item) => ({ itemType: "dimension_member" as const, logicalKey: item.logicalKey, value: item })),
    ...content.accountDimensionPolicies.map((item) => ({ itemType: "account_dimension_policy" as const, logicalKey: policyLogicalKey(item.accountLogicalKey, item.dimensionTypeLogicalKey), value: item })),
  ];
}

function operationalItems(baseline: Readonly<CodingTemplateCompanyBaseline>): ReadonlyMap<string, { readonly id: string; readonly value: unknown }> {
  const values = new Map<string, { readonly id: string; readonly value: unknown }>();
  for (const item of baseline.accounts) {
    if (item.logicalKey) values.set(itemKey("account", item.logicalKey), { id: item.id, value: {
      logicalKey: item.logicalKey, parentLogicalKey: item.parentLogicalKey, level: item.level, code: item.code,
      persianName: item.persianName, englishName: item.englishName, nature: item.nature, normalBalance: item.normalBalance,
      statementType: item.statementType, reportClassification: item.reportClassification, postingAllowed: item.postingAllowed,
      currencyEnabled: item.currencyEnabled, revaluationEnabled: item.revaluationEnabled, trackingEnabled: item.trackingEnabled,
      dueDateEnabled: item.dueDateEnabled, activeByDefault: item.active, displayOrder: item.displayOrder,
    } });
  }
  for (const item of baseline.dimensionTypes) {
    if (item.logicalKey) values.set(itemKey("dimension_type", item.logicalKey), { id: item.id, value: {
      logicalKey: item.logicalKey, code: item.code, persianName: item.persianName, englishName: item.englishName,
      hierarchical: item.hierarchical, allowMultipleMembers: item.allowMultipleMembers,
      activeByDefault: item.active, displayOrder: item.displayOrder,
    } });
  }
  for (const item of baseline.dimensionMembers) {
    if (item.logicalKey) values.set(itemKey("dimension_member", item.logicalKey), { id: item.id, value: {
      logicalKey: item.logicalKey, dimensionTypeLogicalKey: item.dimensionTypeLogicalKey,
      parentLogicalKey: item.parentLogicalKey, code: item.code, persianName: item.persianName,
      englishName: item.englishName, activeByDefault: item.active, displayOrder: item.displayOrder,
    } });
  }
  for (const item of baseline.accountDimensionPolicies) {
    const logicalKey = policyLogicalKey(item.accountLogicalKey, item.dimensionTypeLogicalKey);
    values.set(itemKey("account_dimension_policy", logicalKey), { id: item.id, value: {
      accountLogicalKey: item.accountLogicalKey, dimensionTypeLogicalKey: item.dimensionTypeLogicalKey,
      requirement: item.requirement,
    } });
  }
  return values;
}

function issue(code: CodingTemplateUpgradeIssueCode, itemType: CodingTemplateApplicationItemType | null, logicalKey: string | null, operationalId: string | null): CodingTemplateUpgradeIssue {
  return Object.freeze({ code, itemType, logicalKey, operationalId });
}

export function createCodingTemplateUpgradePlan(input: CreateCodingTemplateUpgradePlanInput): Readonly<CodingTemplateUpgradePlan> {
  const previous = new Map(contentItems(input.fromContent).map((item) => [itemKey(item.itemType, item.logicalKey), item]));
  const target = new Map(contentItems(input.toContent).map((item) => [itemKey(item.itemType, item.logicalKey), item]));
  const operational = operationalItems(input.baseline);
  const mappings = new Map(input.appliedMappings.map((item) => [itemKey(item.itemType, item.logicalKey), item]));
  const keys = new Set([...previous.keys(), ...target.keys()]);
  const globalIssues: CodingTemplateUpgradeIssue[] = [];

  if (input.baseline.companyId !== input.companyId || input.appliedMappings.some((item) => item.companyId !== input.companyId)) {
    globalIssues.push(issue("company_scope_conflict", null, null, null));
  }
  if (input.templateId !== input.toTemplateId) globalIssues.push(issue("template_identity_conflict", null, null, null));
  if (input.toVersionNumber <= input.fromVersionNumber || input.toVersionId === input.fromVersionId) {
    globalIssues.push(issue("version_order_conflict", null, null, null));
  }

  const items = [...keys].sort().map((key): CodingTemplateUpgradeItem => {
    const oldItem = previous.get(key) ?? null;
    const newItem = target.get(key) ?? null;
    const type = (oldItem ?? newItem)!.itemType;
    const logicalKey = (oldItem ?? newItem)!.logicalKey;
    const mapping = mappings.get(key) ?? null;
    const current = operational.get(key) ?? null;
    const issues: CodingTemplateUpgradeIssue[] = [];

    if (oldItem && !mapping) issues.push(issue("mapping_missing", type, logicalKey, current?.id ?? null));
    if (mapping && current && mapping.operationalId !== current.id) issues.push(issue("mapping_identity_conflict", type, logicalKey, current.id));
    if (oldItem && mapping && !current) issues.push(issue("local_item_missing", type, logicalKey, mapping.operationalId));

    const templateChanged = Boolean(oldItem && newItem && !same(oldItem.value, newItem.value));
    const localChanged = Boolean(oldItem && current && !same(oldItem.value, current.value));
    let status: CodingTemplateUpgradeStatus;
    if (!oldItem) status = "newly_available";
    else if (!newItem) status = "retired";
    else if (localChanged && templateChanged && !same(current?.value, newItem.value)) status = "conflicting";
    else if (localChanged) status = "locally_modified";
    else status = "unchanged";

    if (status === "conflicting") issues.push(issue("local_change_conflict", type, logicalKey, current?.id ?? null));
    const decision = input.decisions?.[key] ?? null;
    let action: CodingTemplateUpgradeAction = "none";
    if (status === "newly_available") action = decision === "accept" ? "add" : "none";
    else if (status === "unchanged" && templateChanged) action = decision === "accept" ? "upgrade" : "none";
    else if (status === "locally_modified") action = "preserve_local";
    else if (status === "retired") action = "preserve_retired";
    else if (status === "conflicting") action = "requires_resolution";

    const decisionAllowed = status === "newly_available" || (status === "unchanged" && templateChanged);
    if (decision && !decisionAllowed) issues.push(issue("invalid_upgrade_decision", type, logicalKey, current?.id ?? null));
    return Object.freeze({ itemType: type, logicalKey, operationalId: current?.id ?? mapping?.operationalId ?? null, status, decision, action, templateChanged, localChanged, issues: Object.freeze(issues) });
  });

  const issues = Object.freeze([...globalIssues, ...items.flatMap((item) => item.issues)]);
  const summary = Object.freeze({
    unchanged: items.filter((item) => item.status === "unchanged").length,
    locallyModified: items.filter((item) => item.status === "locally_modified").length,
    newlyAvailable: items.filter((item) => item.status === "newly_available").length,
    conflicting: items.filter((item) => item.status === "conflicting").length,
    retired: items.filter((item) => item.status === "retired").length,
    accepted: items.filter((item) => item.decision === "accept").length,
    skipped: items.filter((item) => item.decision === "skip" || ((item.status === "newly_available" || (item.status === "unchanged" && item.templateChanged)) && item.decision === null)).length,
  });
  return Object.freeze({ companyId: input.companyId, templateId: input.templateId, fromVersionId: input.fromVersionId, fromVersionNumber: input.fromVersionNumber, toVersionId: input.toVersionId, toVersionNumber: input.toVersionNumber, canApply: issues.length === 0, items: Object.freeze(items), issues, summary });
}
