import { createAccount } from "../domain/create-account.ts";
import { createAccountReportClassification } from "../domain/create-account-report-classification.ts";
import type {
  CodingTemplateAccountItem,
  CodingTemplateDimensionMemberItem,
  CodingTemplateDimensionTypeItem,
  CodingTemplateVersionContent,
} from "../domain/coding-template-items.ts";
import { validateAccount } from "./validate-account.ts";
import { validateAccountReportClassification } from "./validate-account-report-classification.ts";
import type {
  CodingTemplateGraphItemType,
  CodingTemplateGraphValidationIssue,
} from "./coding-template-graph-validation-error.ts";

const LOGICAL_KEY_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const DIMENSION_CODE_PATTERN = /^[A-Z][A-Z0-9_-]{0,49}$/;
const MEMBER_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_.-]{0,49}$/;
const requirements = new Set(["required", "optional", "forbidden"]);

export function validateCodingTemplateGraph(
  content: CodingTemplateVersionContent,
): readonly CodingTemplateGraphValidationIssue[] {
  const issues: CodingTemplateGraphValidationIssue[] = [];
  const accounts = indexItems(content.accounts, "account", issues);
  const dimensionTypes = indexItems(content.dimensionTypes, "dimension_type", issues);
  const members = indexItems(content.dimensionMembers, "dimension_member", issues);

  validateDuplicateCodes(content.accounts, "account", issues);
  validateDuplicateCodes(content.dimensionTypes, "dimension_type", issues);
  validateMemberCodes(content.dimensionMembers, issues);
  content.accounts.forEach((item) => validateAccountItem(item, accounts, issues));
  content.dimensionTypes.forEach((item) => validateDimensionType(item, issues));
  content.dimensionMembers.forEach((item) =>
    validateDimensionMember(item, dimensionTypes, members, issues)
  );
  detectCycles(content.accounts, accounts, "account", issues);
  detectCycles(content.dimensionMembers, members, "dimension_member", issues);
  validatePolicies(content, accounts, dimensionTypes, issues);

  return Object.freeze(issues);
}

function indexItems<T extends { readonly logicalKey: string }>(
  items: readonly T[],
  itemType: CodingTemplateGraphItemType,
  issues: CodingTemplateGraphValidationIssue[],
): ReadonlyMap<string, T> {
  const result = new Map<string, T>();
  for (const item of items) {
    if (!item.logicalKey.trim()) {
      add(issues, "logical_key_required", itemType, null, "logicalKey", "کلید منطقی الزامی است.");
      continue;
    }
    if (!LOGICAL_KEY_PATTERN.test(item.logicalKey)) {
      add(issues, "logical_key_invalid", itemType, item.logicalKey, "logicalKey", "کلید منطقی باید پایدار، انگلیسی و با حروف کوچک باشد.");
    }
    if (result.has(item.logicalKey)) {
      add(issues, "duplicate_logical_key", itemType, item.logicalKey, "logicalKey", "کلید منطقی تکراری است.");
    } else {
      result.set(item.logicalKey, item);
    }
  }
  return result;
}

function validateDuplicateCodes<T extends { readonly logicalKey: string; readonly code: string }>(
  items: readonly T[],
  itemType: CodingTemplateGraphItemType,
  issues: CodingTemplateGraphValidationIssue[],
): void {
  const codes = new Set<string>();
  for (const item of items) {
    const key = item.code.toUpperCase();
    if (codes.has(key)) {
      add(issues, "duplicate_code", itemType, item.logicalKey, "code", "کد در الگو تکراری است.");
    }
    codes.add(key);
  }
}

function validateMemberCodes(
  items: readonly CodingTemplateDimensionMemberItem[],
  issues: CodingTemplateGraphValidationIssue[],
): void {
  const codes = new Set<string>();
  for (const item of items) {
    const key = `${item.dimensionTypeLogicalKey}\u0000${item.code.toUpperCase()}`;
    if (codes.has(key)) {
      add(issues, "duplicate_code", "dimension_member", item.logicalKey, "code", "کد عضو در همان نوع بُعد تکراری است.");
    }
    codes.add(key);
  }
}

function validateAccountItem(
  item: CodingTemplateAccountItem,
  accounts: ReadonlyMap<string, CodingTemplateAccountItem>,
  issues: CodingTemplateGraphValidationIssue[],
): void {
  try {
    const classification = createAccountReportClassification(item.reportClassification, {
      statementType: item.statementType,
    });
    const account = createAccount({
      id: item.logicalKey || "invalid",
      companyId: "template-validation",
      parentId: item.parentLogicalKey,
      level: item.level,
      code: item.code,
      name: item.persianName,
      englishName: item.englishName,
      nature: item.nature,
      normalBalance: item.normalBalance,
      statementType: item.statementType,
      reportClassification: classification,
      postingAllowed: item.postingAllowed,
      currencyEnabled: item.currencyEnabled,
      revaluationEnabled: item.revaluationEnabled,
      trackingEnabled: item.trackingEnabled,
      dueDateEnabled: item.dueDateEnabled,
      status: item.activeByDefault ? "active" : "inactive",
      displayOrder: item.displayOrder,
      createdAt: "2000-01-01T00:00:00.000Z",
    });
    if (validateAccount(account).length || validateAccountReportClassification(classification, item.statementType).length) {
      add(issues, "invalid_item", "account", item.logicalKey, "account", "مشخصات یا طبقه‌بندی حساب معتبر نیست.");
    }
  } catch {
    add(issues, "invalid_item", "account", item.logicalKey || null, "account", "مشخصات یا طبقه‌بندی حساب معتبر نیست.");
  }

  if (item.level === "group" && item.parentLogicalKey !== null) {
    add(issues, "parent_not_allowed", "account", item.logicalKey, "parentLogicalKey", "حساب گروه نمی‌تواند والد داشته باشد.");
    return;
  }
  if (item.level !== "group" && item.parentLogicalKey === null) {
    add(issues, "parent_required", "account", item.logicalKey, "parentLogicalKey", "برای حساب کل یا معین، والد الزامی است.");
    return;
  }
  if (item.parentLogicalKey !== null) {
    const parent = accounts.get(item.parentLogicalKey);
    if (!parent) {
      add(issues, "parent_not_found", "account", item.logicalKey, "parentLogicalKey", "والد حساب در نسخه الگو وجود ندارد.");
    } else {
      const expected = item.level === "general" ? "group" : "general";
      if (parent.level !== expected) {
        add(issues, "parent_level_invalid", "account", item.logicalKey, "parentLogicalKey", "سطح والد حساب با سلسله‌مراتب گروه، کل و معین سازگار نیست.");
      }
    }
  }
}

function validateDimensionType(
  item: CodingTemplateDimensionTypeItem,
  issues: CodingTemplateGraphValidationIssue[],
): void {
  if (!DIMENSION_CODE_PATTERN.test(item.code) || !item.persianName.trim() || !validOrder(item.displayOrder)) {
    add(issues, "invalid_item", "dimension_type", item.logicalKey, "dimensionType", "مشخصات نوع بُعد معتبر نیست.");
  }
}

function validateDimensionMember(
  item: CodingTemplateDimensionMemberItem,
  dimensionTypes: ReadonlyMap<string, CodingTemplateDimensionTypeItem>,
  members: ReadonlyMap<string, CodingTemplateDimensionMemberItem>,
  issues: CodingTemplateGraphValidationIssue[],
): void {
  const type = dimensionTypes.get(item.dimensionTypeLogicalKey);
  if (!type) {
    add(issues, "dimension_type_not_found", "dimension_member", item.logicalKey, "dimensionTypeLogicalKey", "نوع بُعد عضو در نسخه الگو وجود ندارد.");
  }
  if (!MEMBER_CODE_PATTERN.test(item.code) || !item.persianName.trim() || !validOrder(item.displayOrder)) {
    add(issues, "invalid_item", "dimension_member", item.logicalKey, "dimensionMember", "مشخصات عضو بُعد معتبر نیست.");
  }
  if (item.parentLogicalKey !== null) {
    if (type && !type.hierarchical) {
      add(issues, "members_not_allowed", "dimension_member", item.logicalKey, "parentLogicalKey", "نوع بُعد غیرسلسله‌مراتبی نمی‌تواند عضو والددار داشته باشد.");
    }
    const parent = members.get(item.parentLogicalKey);
    if (!parent) {
      add(issues, "parent_not_found", "dimension_member", item.logicalKey, "parentLogicalKey", "والد عضو بُعد در نسخه الگو وجود ندارد.");
    } else if (parent.dimensionTypeLogicalKey !== item.dimensionTypeLogicalKey) {
      add(issues, "parent_dimension_mismatch", "dimension_member", item.logicalKey, "parentLogicalKey", "عضو و والد آن باید متعلق به یک نوع بُعد باشند.");
    }
  }
}

function detectCycles<T extends { readonly logicalKey: string; readonly parentLogicalKey: string | null }>(
  items: readonly T[],
  index: ReadonlyMap<string, T>,
  itemType: "account" | "dimension_member",
  issues: CodingTemplateGraphValidationIssue[],
): void {
  for (const item of items) {
    const visited = new Set<string>([item.logicalKey]);
    let parentKey = item.parentLogicalKey;
    while (parentKey !== null) {
      if (visited.has(parentKey)) {
        add(issues, "hierarchy_cycle", itemType, item.logicalKey, "parentLogicalKey", "در سلسله‌مراتب الگو چرخه وجود دارد.");
        break;
      }
      visited.add(parentKey);
      parentKey = index.get(parentKey)?.parentLogicalKey ?? null;
    }
  }
}

function validatePolicies(
  content: CodingTemplateVersionContent,
  accounts: ReadonlyMap<string, CodingTemplateAccountItem>,
  dimensionTypes: ReadonlyMap<string, CodingTemplateDimensionTypeItem>,
  issues: CodingTemplateGraphValidationIssue[],
): void {
  const pairs = new Set<string>();
  for (const policy of content.accountDimensionPolicies) {
    const pair = `${policy.accountLogicalKey}\u0000${policy.dimensionTypeLogicalKey}`;
    if (pairs.has(pair)) {
      add(issues, "duplicate_policy", "account_dimension_policy", policy.accountLogicalKey, "dimensionTypeLogicalKey", "برای این حساب و نوع بُعد بیش از یک سیاست تعریف شده است.");
    }
    pairs.add(pair);
    const account = accounts.get(policy.accountLogicalKey);
    if (!account) {
      add(issues, "account_not_found", "account_dimension_policy", policy.accountLogicalKey, "accountLogicalKey", "حساب سیاست در نسخه الگو وجود ندارد.");
    } else if (!account.postingAllowed) {
      add(issues, "policy_not_allowed", "account_dimension_policy", policy.accountLogicalKey, "accountLogicalKey", "سیاست بُعد فقط برای حساب قابل ثبت مجاز است.");
    }
    if (!dimensionTypes.has(policy.dimensionTypeLogicalKey)) {
      add(issues, "dimension_type_not_found", "account_dimension_policy", policy.accountLogicalKey, "dimensionTypeLogicalKey", "نوع بُعد سیاست در نسخه الگو وجود ندارد.");
    }
    if (!requirements.has(policy.requirement)) {
      add(issues, "policy_requirement_invalid", "account_dimension_policy", policy.accountLogicalKey, "requirement", "نوع الزام سیاست بُعد معتبر نیست.");
    }
  }
}

function validOrder(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function add(
  issues: CodingTemplateGraphValidationIssue[],
  code: CodingTemplateGraphValidationIssue["code"],
  itemType: CodingTemplateGraphItemType,
  logicalKey: string | null,
  field: string,
  message: string,
): void {
  issues.push({ code, itemType, logicalKey, field, message });
}
