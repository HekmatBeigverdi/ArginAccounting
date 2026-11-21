import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./sales-posting-domain-errors.ts";
import type { SalesPostingDomainErrorCode } from "./sales-posting-domain-errors.ts";
import type {
  SalesPostingAccountReader,
  SalesPostingAccountSnapshot,
} from "./sales-revenue-account-resolution.ts";

export const SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE = "accounts-receivable" as const;
export type SalesAccountsReceivableAccountRole =
  typeof SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE;

export interface SalesAccountsReceivableAccountRule {
  readonly ruleId: string;
  readonly companyId: string;
  readonly branchId: string | null;
  readonly accountRole: SalesAccountsReceivableAccountRole;
  readonly accountId: string;
  readonly priority: number;
  readonly active: boolean;
}

export interface SalesAccountsReceivableResolutionContext {
  readonly companyId: string;
  readonly branchId: string;
  readonly customerPartyId: string;
  readonly accountRole: SalesAccountsReceivableAccountRole;
}

export interface SalesAccountsReceivableResolution {
  readonly ruleId: string;
  readonly accountRole: SalesAccountsReceivableAccountRole;
  readonly customerPartyId: string;
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

export function createSalesAccountsReceivableAccountRule(
  input: SalesAccountsReceivableAccountRule,
): SalesAccountsReceivableAccountRule {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, "rule");
  }
  if (input.accountRole !== SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE) {
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
    accountRole: SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
    accountId: required(input.accountId, "rule.accountId"),
    priority: input.priority,
    active: input.active,
  });
}

function specificity(rule: SalesAccountsReceivableAccountRule): number {
  return rule.branchId === null ? 0 : 1;
}

function matches(
  rule: SalesAccountsReceivableAccountRule,
  context: SalesAccountsReceivableResolutionContext,
): boolean {
  return rule.active
    && rule.companyId === context.companyId
    && rule.accountRole === context.accountRole
    && (rule.branchId === null || rule.branchId === context.branchId);
}

export function selectSalesAccountsReceivableAccountRule(
  rules: readonly SalesAccountsReceivableAccountRule[],
  context: SalesAccountsReceivableResolutionContext,
): SalesAccountsReceivableAccountRule {
  if (!Array.isArray(rules)) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, "rules");
  }
  if (typeof context !== "object" || context === null || Array.isArray(context)) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, "context");
  }
  if (context.accountRole !== SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid,
      "context.accountRole",
    );
  }

  const normalizedContext = Object.freeze({
    companyId: required(context.companyId, "context.companyId"),
    branchId: required(context.branchId, "context.branchId"),
    customerPartyId: required(context.customerPartyId, "context.customerPartyId"),
    accountRole: SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
  });

  const candidates = rules
    .map(createSalesAccountsReceivableAccountRule)
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

export async function resolveSalesAccountsReceivableAccount(
  rules: readonly SalesAccountsReceivableAccountRule[],
  context: SalesAccountsReceivableResolutionContext,
  accounts: SalesPostingAccountReader,
): Promise<SalesAccountsReceivableResolution> {
  if (!accounts || typeof accounts.findById !== "function") {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.accountInvalid, "accounts");
  }

  const customerPartyId = required(
    context.customerPartyId,
    "context.customerPartyId",
  );
  const rule = selectSalesAccountsReceivableAccountRule(rules, context);
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
    accountRole: SALES_ACCOUNTS_RECEIVABLE_ACCOUNT_ROLE,
    customerPartyId,
    account: Object.freeze({ ...account }),
  });
}
