import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./sales-posting-domain-errors.ts";
import type { SalesPostingDomainErrorCode } from "./sales-posting-domain-errors.ts";
import type {
  SalesPostingAccountReader,
  SalesPostingAccountSnapshot,
} from "./sales-revenue-account-resolution.ts";

export const SALES_INVENTORY_ACCOUNT_ROLE = "inventory-asset" as const;
export type SalesInventoryAccountRole = typeof SALES_INVENTORY_ACCOUNT_ROLE;

export interface SalesInventoryAccountRule {
  readonly ruleId: string;
  readonly companyId: string;
  readonly branchId: string | null;
  readonly accountRole: SalesInventoryAccountRole;
  readonly accountId: string;
  readonly priority: number;
  readonly active: boolean;
}

export interface SalesInventoryAccountResolutionContext {
  readonly companyId: string;
  readonly branchId: string;
  readonly salesLineId: string;
  readonly productId: string;
  readonly movementId: string;
  readonly valuationEntryId: string;
  readonly warehouseId: string;
  readonly accountRole: SalesInventoryAccountRole;
}

export interface SalesInventoryAccountResolution {
  readonly ruleId: string;
  readonly accountRole: SalesInventoryAccountRole;
  readonly salesLineId: string;
  readonly productId: string;
  readonly movementId: string;
  readonly valuationEntryId: string;
  readonly warehouseId: string;
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

export function createSalesInventoryAccountRule(
  input: SalesInventoryAccountRule,
): SalesInventoryAccountRule {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, "rule");
  }
  if (input.accountRole !== SALES_INVENTORY_ACCOUNT_ROLE) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid,
      "rule.accountRole",
    );
  }
  if (!Number.isSafeInteger(input.priority) || input.priority < 0) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid,
      "rule.priority",
    );
  }
  if (typeof input.active !== "boolean") {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid,
      "rule.active",
    );
  }

  return Object.freeze({
    ruleId: required(input.ruleId, "rule.ruleId"),
    companyId: required(input.companyId, "rule.companyId"),
    branchId: optionalIdentity(input.branchId, "rule.branchId"),
    accountRole: SALES_INVENTORY_ACCOUNT_ROLE,
    accountId: required(input.accountId, "rule.accountId"),
    priority: input.priority,
    active: input.active,
  });
}

function specificity(rule: SalesInventoryAccountRule): number {
  return rule.branchId === null ? 0 : 1;
}

function matches(
  rule: SalesInventoryAccountRule,
  context: SalesInventoryAccountResolutionContext,
): boolean {
  return rule.active
    && rule.companyId === context.companyId
    && rule.accountRole === context.accountRole
    && (rule.branchId === null || rule.branchId === context.branchId);
}

function normalizeContext(
  context: SalesInventoryAccountResolutionContext,
): SalesInventoryAccountResolutionContext {
  if (
    typeof context !== "object"
    || context === null
    || Array.isArray(context)
  ) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, "context");
  }
  if (context.accountRole !== SALES_INVENTORY_ACCOUNT_ROLE) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid,
      "context.accountRole",
    );
  }

  return Object.freeze({
    companyId: required(context.companyId, "context.companyId"),
    branchId: required(context.branchId, "context.branchId"),
    salesLineId: required(context.salesLineId, "context.salesLineId"),
    productId: required(context.productId, "context.productId"),
    movementId: required(context.movementId, "context.movementId"),
    valuationEntryId: required(
      context.valuationEntryId,
      "context.valuationEntryId",
    ),
    warehouseId: required(context.warehouseId, "context.warehouseId"),
    accountRole: SALES_INVENTORY_ACCOUNT_ROLE,
  });
}

export function selectSalesInventoryAccountRule(
  rules: readonly SalesInventoryAccountRule[],
  context: SalesInventoryAccountResolutionContext,
): SalesInventoryAccountRule {
  if (!Array.isArray(rules)) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, "rules");
  }

  const normalizedContext = normalizeContext(context);
  const candidates = rules
    .map(createSalesInventoryAccountRule)
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
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.postingRuleAmbiguous,
      "rules",
    );
  }

  return first;
}

export async function resolveSalesInventoryAccount(
  rules: readonly SalesInventoryAccountRule[],
  context: SalesInventoryAccountResolutionContext,
  accounts: SalesPostingAccountReader,
): Promise<SalesInventoryAccountResolution> {
  if (!accounts || typeof accounts.findById !== "function") {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.accountInvalid, "accounts");
  }

  const normalizedContext = normalizeContext(context);
  const rule = selectSalesInventoryAccountRule(rules, normalizedContext);
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
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.accountInvalid,
      "account",
    );
  }

  if (account.status !== "active" || account.postingAllowed !== true) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.accountNotPostable,
      "account",
    );
  }

  return Object.freeze({
    ruleId: rule.ruleId,
    accountRole: SALES_INVENTORY_ACCOUNT_ROLE,
    salesLineId: normalizedContext.salesLineId,
    productId: normalizedContext.productId,
    movementId: normalizedContext.movementId,
    valuationEntryId: normalizedContext.valuationEntryId,
    warehouseId: normalizedContext.warehouseId,
    account: Object.freeze({ ...account }),
  });
}
