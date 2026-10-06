import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./sales-posting-domain-errors.ts";
import type { SalesPostingDomainErrorCode } from "./sales-posting-domain-errors.ts";
import type {
  SalesPostingAccountReader,
  SalesPostingAccountSnapshot,
} from "./sales-revenue-account-resolution.ts";

export const SALES_OUTPUT_VAT_ACCOUNT_ROLE = "output-vat" as const;
export type SalesOutputVatAccountRole = typeof SALES_OUTPUT_VAT_ACCOUNT_ROLE;

export interface SalesOutputVatAccountRule {
  readonly ruleId: string;
  readonly companyId: string;
  readonly branchId: string | null;
  readonly taxCode: string | null;
  readonly accountRole: SalesOutputVatAccountRole;
  readonly accountId: string;
  readonly priority: number;
  readonly active: boolean;
}

export interface SalesOutputVatResolutionContext {
  readonly companyId: string;
  readonly branchId: string;
  readonly taxId: string;
  readonly taxCode: string | null;
  readonly rateBasisPoints: number;
  readonly accountRole: SalesOutputVatAccountRole;
}

export interface SalesOutputVatAccountResolution {
  readonly ruleId: string;
  readonly accountRole: SalesOutputVatAccountRole;
  readonly taxId: string;
  readonly taxCode: string | null;
  readonly rateBasisPoints: number;
  readonly account: SalesPostingAccountSnapshot;
}

const fail = (code: SalesPostingDomainErrorCode, field: string): never => {
  throw new SalesPostingDomainError(code, field);
};

function required(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.identityRequired, field);
  }
  return value.trim();
}

function optionalIdentity(value: string | null, field: string): string | null {
  if (value === null) return null;
  return required(value, field);
}

function taxCode(value: string | null, field: string): string | null {
  if (value === null) return null;
  return required(value, field).toUpperCase();
}

function rateBasisPoints(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10_000) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, field);
  }
  return value;
}

export function createSalesOutputVatAccountRule(
  input: SalesOutputVatAccountRule,
): SalesOutputVatAccountRule {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, "rule");
  }
  if (input.accountRole !== SALES_OUTPUT_VAT_ACCOUNT_ROLE) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid,
      "rule.accountRole",
    );
  }
  if (!Number.isSafeInteger(input.priority) || input.priority < 0) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, "rule.priority");
  }
  if (typeof input.active !== "boolean") {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, "rule.active");
  }

  return Object.freeze({
    ruleId: required(input.ruleId, "rule.ruleId"),
    companyId: required(input.companyId, "rule.companyId"),
    branchId: optionalIdentity(input.branchId, "rule.branchId"),
    taxCode: taxCode(input.taxCode, "rule.taxCode"),
    accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
    accountId: required(input.accountId, "rule.accountId"),
    priority: input.priority,
    active: input.active,
  });
}

function specificity(rule: SalesOutputVatAccountRule): number {
  return (rule.branchId === null ? 0 : 2)
    + (rule.taxCode === null ? 0 : 1);
}

function matches(
  rule: SalesOutputVatAccountRule,
  context: SalesOutputVatResolutionContext,
): boolean {
  return rule.active
    && rule.companyId === context.companyId
    && rule.accountRole === context.accountRole
    && (rule.branchId === null || rule.branchId === context.branchId)
    && (rule.taxCode === null || rule.taxCode === context.taxCode);
}

export function selectSalesOutputVatAccountRule(
  rules: readonly SalesOutputVatAccountRule[],
  context: SalesOutputVatResolutionContext,
): SalesOutputVatAccountRule {
  if (!Array.isArray(rules)) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, "rules");
  }
  if (typeof context !== "object" || context === null || Array.isArray(context)) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, "context");
  }
  if (context.accountRole !== SALES_OUTPUT_VAT_ACCOUNT_ROLE) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid,
      "context.accountRole",
    );
  }

  const normalizedContext = Object.freeze({
    companyId: required(context.companyId, "context.companyId"),
    branchId: required(context.branchId, "context.branchId"),
    taxId: required(context.taxId, "context.taxId"),
    taxCode: taxCode(context.taxCode, "context.taxCode"),
    rateBasisPoints: rateBasisPoints(
      context.rateBasisPoints,
      "context.rateBasisPoints",
    ),
    accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
  });

  const candidates = rules
    .map(createSalesOutputVatAccountRule)
    .filter((rule) => matches(rule, normalizedContext))
    .sort((left, right) => {
      const specificityDiff = specificity(right) - specificity(left);
      if (specificityDiff !== 0) return specificityDiff;
      const priorityDiff = right.priority - left.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return left.ruleId.localeCompare(right.ruleId);
    });

  if (candidates.length === 0) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.accountMappingMissing,
      "context.accountRole",
    );
  }

  const first = candidates[0]!;
  const second = candidates[1];
  if (
    second
    && specificity(second) === specificity(first)
    && second.priority === first.priority
  ) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleAmbiguous, "rules");
  }

  return first;
}

export async function resolveSalesOutputVatAccount(
  rules: readonly SalesOutputVatAccountRule[],
  context: SalesOutputVatResolutionContext,
  accounts: SalesPostingAccountReader,
): Promise<SalesOutputVatAccountResolution> {
  if (!accounts || typeof accounts.findById !== "function") {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.accountInvalid, "accounts");
  }

  const normalizedContext = Object.freeze({
    companyId: required(context.companyId, "context.companyId"),
    branchId: required(context.branchId, "context.branchId"),
    taxId: required(context.taxId, "context.taxId"),
    taxCode: taxCode(context.taxCode, "context.taxCode"),
    rateBasisPoints: rateBasisPoints(
      context.rateBasisPoints,
      "context.rateBasisPoints",
    ),
    accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
  });

  const rule = selectSalesOutputVatAccountRule(rules, normalizedContext);
  const account = await accounts.findById(
    normalizedContext.companyId,
    rule.accountId,
  );

  if (account === null) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.accountMappingMissing,
      "rule.accountId",
    );
  }

  if (
    typeof account !== "object"
    || account.accountId !== rule.accountId
    || account.companyId !== normalizedContext.companyId
  ) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.accountInvalid, "account");
  }

  if (account.status !== "active" || account.postingAllowed !== true) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.accountNotPostable, "account");
  }

  return Object.freeze({
    ruleId: rule.ruleId,
    accountRole: SALES_OUTPUT_VAT_ACCOUNT_ROLE,
    taxId: normalizedContext.taxId,
    taxCode: normalizedContext.taxCode,
    rateBasisPoints: normalizedContext.rateBasisPoints,
    account: Object.freeze({ ...account }),
  });
}
