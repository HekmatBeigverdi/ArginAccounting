import type { SalesLineKind } from "@argin/sales";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./sales-posting-domain-errors.ts";
import type { SalesPostingDomainErrorCode } from "./sales-posting-domain-errors.ts";

export const SALES_REVENUE_ACCOUNT_ROLE = "sales-revenue" as const;
export type SalesRevenueAccountRole = typeof SALES_REVENUE_ACCOUNT_ROLE;

export interface SalesPostingAccountSnapshot {
  readonly accountId: string;
  readonly companyId: string;
  readonly code: string;
  readonly name: string;
  readonly status: "active" | "inactive";
  readonly postingAllowed: boolean;
}

export interface SalesRevenueAccountRule {
  readonly ruleId: string;
  readonly companyId: string;
  readonly branchId: string | null;
  readonly lineKind: SalesLineKind | null;
  readonly accountRole: SalesRevenueAccountRole;
  readonly accountId: string;
  readonly priority: number;
  readonly active: boolean;
}

export interface SalesRevenueAccountResolutionContext {
  readonly companyId: string;
  readonly branchId: string;
  readonly lineKind: SalesLineKind;
  readonly accountRole: SalesRevenueAccountRole;
}

export interface SalesPostingAccountReader {
  findById(companyId: string, accountId: string): Promise<SalesPostingAccountSnapshot | null>;
}

export interface SalesRevenueAccountResolution {
  readonly ruleId: string;
  readonly accountRole: SalesRevenueAccountRole;
  readonly lineKind: SalesLineKind;
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

function assertLineKind(value: SalesLineKind | null, field: string): SalesLineKind | null {
  if (
    value !== null
    && value !== "stock-product"
    && value !== "non-stock-product"
    && value !== "service"
  ) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, field);
  }
  return value;
}

export function createSalesRevenueAccountRule(
  input: SalesRevenueAccountRule,
): SalesRevenueAccountRule {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, "rule");
  }
  if (input.accountRole !== SALES_REVENUE_ACCOUNT_ROLE) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, "rule.accountRole");
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
    lineKind: assertLineKind(input.lineKind, "rule.lineKind"),
    accountRole: SALES_REVENUE_ACCOUNT_ROLE,
    accountId: required(input.accountId, "rule.accountId"),
    priority: input.priority,
    active: input.active,
  });
}

function specificity(rule: SalesRevenueAccountRule): number {
  return (rule.branchId === null ? 0 : 2)
    + (rule.lineKind === null ? 0 : 1);
}

function matches(
  rule: SalesRevenueAccountRule,
  context: SalesRevenueAccountResolutionContext,
): boolean {
  return rule.active
    && rule.companyId === context.companyId
    && rule.accountRole === context.accountRole
    && (rule.branchId === null || rule.branchId === context.branchId)
    && (rule.lineKind === null || rule.lineKind === context.lineKind);
}

export function selectSalesRevenueAccountRule(
  rules: readonly SalesRevenueAccountRule[],
  context: SalesRevenueAccountResolutionContext,
): SalesRevenueAccountRule {
  if (!Array.isArray(rules)) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, "rules");
  }
  if (typeof context !== "object" || context === null || Array.isArray(context)) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, "context");
  }
  if (context.accountRole !== SALES_REVENUE_ACCOUNT_ROLE) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, "context.accountRole");
  }

  const normalizedContext = Object.freeze({
    companyId: required(context.companyId, "context.companyId"),
    branchId: required(context.branchId, "context.branchId"),
    lineKind: assertLineKind(context.lineKind, "context.lineKind") as SalesLineKind,
    accountRole: SALES_REVENUE_ACCOUNT_ROLE,
  });

  const candidates = rules
    .map(createSalesRevenueAccountRule)
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

export async function resolveSalesRevenueAccount(
  rules: readonly SalesRevenueAccountRule[],
  context: SalesRevenueAccountResolutionContext,
  accounts: SalesPostingAccountReader,
): Promise<SalesRevenueAccountResolution> {
  if (!accounts || typeof accounts.findById !== "function") {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.accountInvalid, "accounts");
  }

  const rule = selectSalesRevenueAccountRule(rules, context);
  const account = await accounts.findById(context.companyId, rule.accountId);

  if (account === null) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.accountMappingMissing,
      "rule.accountId",
    );
  }

  if (
    typeof account !== "object"
    || account.accountId !== rule.accountId
    || account.companyId !== context.companyId
  ) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.accountInvalid, "account");
  }

  if (account.status !== "active" || account.postingAllowed !== true) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.accountNotPostable, "account");
  }

  return Object.freeze({
    ruleId: rule.ruleId,
    accountRole: SALES_REVENUE_ACCOUNT_ROLE,
    lineKind: context.lineKind,
    account: Object.freeze({ ...account }),
  });
}
