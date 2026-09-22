import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
} from "./purchase-posting-domain-errors.ts";
import type { PurchasePostingDomainErrorCode } from "./purchase-posting-domain-errors.ts";
import {
  PURCHASE_POSTING_EVENT_KINDS,
} from "./purchase-posting-event-classification.ts";
import type {
  PurchasePostingEventKind,
} from "./purchase-posting-event-classification.ts";
import {
  PURCHASE_POSTING_LINE_KINDS,
} from "./purchase-posting-facts.ts";
import type {
  PurchasePostingLineKind,
} from "./purchase-posting-facts.ts";

export const PURCHASE_POSTING_ACCOUNT_ROLES = Object.freeze([
  "inventory-asset",
  "purchase-expense",
  "accounts-payable",
  "input-vat-recoverable",
  "purchase-charge",
  "grni",
] as const);

export type PurchasePostingAccountRole =
  (typeof PURCHASE_POSTING_ACCOUNT_ROLES)[number];

export interface PurchasePostingAccountSnapshot {
  readonly accountId: string;
  readonly companyId: string;
  readonly code: string;
  readonly name: string;
  readonly status: "active" | "inactive";
  readonly postingAllowed: boolean;
}

export interface PurchasePostingRule {
  readonly ruleId: string;
  readonly companyId: string;
  readonly branchId: string | null;
  readonly eventKind: Exclude<PurchasePostingEventKind, "none"> | null;
  readonly lineKind: PurchasePostingLineKind | null;
  readonly accountRole: PurchasePostingAccountRole;
  readonly accountId: string;
  readonly priority: number;
  readonly active: boolean;
}

export interface CreatePurchasePostingRuleInput extends PurchasePostingRule {}

export interface PurchasePostingAccountResolutionContext {
  readonly companyId: string;
  readonly branchId: string;
  readonly eventKind: Exclude<PurchasePostingEventKind, "none">;
  readonly lineKind: PurchasePostingLineKind | null;
  readonly accountRole: PurchasePostingAccountRole;
}

export interface PurchasePostingAccountReader {
  findById(companyId: string, accountId: string): Promise<PurchasePostingAccountSnapshot | null>;
}

export interface PurchasePostingAccountResolution {
  readonly ruleId: string;
  readonly accountRole: PurchasePostingAccountRole;
  readonly account: PurchasePostingAccountSnapshot;
}

const fail = (code: PurchasePostingDomainErrorCode, field: string): never => {
  throw new PurchasePostingDomainError(code, field);
};

function required(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.identityRequired, field);
  }
  return value.trim();
}

function optionalIdentity(value: string | null, field: string): string | null {
  if (value === null) return null;
  return required(value, field);
}

function assertRole(value: PurchasePostingAccountRole, field: string): PurchasePostingAccountRole {
  if (!PURCHASE_POSTING_ACCOUNT_ROLES.includes(value)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, field);
  }
  return value;
}

function assertEventKind(
  value: PurchasePostingEventKind | null,
  field: string,
): PurchasePostingRule["eventKind"] {
  if (value === null) return null;
  if (value === "none" || !PURCHASE_POSTING_EVENT_KINDS.includes(value)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, field);
  }
  return value;
}

function assertLineKind(
  value: PurchasePostingLineKind | null,
  field: string,
): PurchasePostingLineKind | null {
  if (value === null) return null;
  if (!PURCHASE_POSTING_LINE_KINDS.includes(value)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, field);
  }
  return value;
}

export function createPurchasePostingRule(
  input: CreatePurchasePostingRuleInput,
): PurchasePostingRule {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, "rule");
  }
  if (!Number.isSafeInteger(input.priority) || input.priority < 0) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, "rule.priority");
  }
  if (typeof input.active !== "boolean") {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, "rule.active");
  }

  return Object.freeze({
    ruleId: required(input.ruleId, "rule.ruleId"),
    companyId: required(input.companyId, "rule.companyId"),
    branchId: optionalIdentity(input.branchId, "rule.branchId"),
    eventKind: assertEventKind(input.eventKind, "rule.eventKind"),
    lineKind: assertLineKind(input.lineKind, "rule.lineKind"),
    accountRole: assertRole(input.accountRole, "rule.accountRole"),
    accountId: required(input.accountId, "rule.accountId"),
    priority: input.priority,
    active: input.active,
  });
}

function specificity(rule: PurchasePostingRule): number {
  return (rule.branchId === null ? 0 : 4)
    + (rule.eventKind === null ? 0 : 2)
    + (rule.lineKind === null ? 0 : 1);
}

function matches(
  rule: PurchasePostingRule,
  context: PurchasePostingAccountResolutionContext,
): boolean {
  return rule.active
    && rule.companyId === context.companyId
    && rule.accountRole === context.accountRole
    && (rule.branchId === null || rule.branchId === context.branchId)
    && (rule.eventKind === null || rule.eventKind === context.eventKind)
    && (rule.lineKind === null || rule.lineKind === context.lineKind);
}

export function selectPurchasePostingRule(
  rules: readonly PurchasePostingRule[],
  context: PurchasePostingAccountResolutionContext,
): PurchasePostingRule {
  if (!Array.isArray(rules)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, "rules");
  }
  if (typeof context !== "object" || context === null || Array.isArray(context)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.postingRuleInvalid, "context");
  }

  const normalizedContext = Object.freeze({
    companyId: required(context.companyId, "context.companyId"),
    branchId: required(context.branchId, "context.branchId"),
    eventKind: assertEventKind(context.eventKind, "context.eventKind") as Exclude<PurchasePostingEventKind, "none">,
    lineKind: assertLineKind(context.lineKind, "context.lineKind"),
    accountRole: assertRole(context.accountRole, "context.accountRole"),
  });

  const candidates = rules
    .map(createPurchasePostingRule)
    .filter(rule => matches(rule, normalizedContext))
    .sort((left, right) => {
      const specificityDiff = specificity(right) - specificity(left);
      if (specificityDiff !== 0) return specificityDiff;
      const priorityDiff = right.priority - left.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return left.ruleId.localeCompare(right.ruleId);
    });

  if (candidates.length === 0) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.accountMappingMissing, "context.accountRole");
  }

  const first = candidates[0]!;
  const second = candidates[1];
  if (
    second
    && specificity(second) === specificity(first)
    && second.priority === first.priority
  ) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.postingRuleAmbiguous, "rules");
  }

  return first;
}

export async function resolvePurchasePostingAccount(
  rules: readonly PurchasePostingRule[],
  context: PurchasePostingAccountResolutionContext,
  accounts: PurchasePostingAccountReader,
): Promise<PurchasePostingAccountResolution> {
  if (!accounts || typeof accounts.findById !== "function") {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.accountInvalid, "accounts");
  }

  const rule = selectPurchasePostingRule(rules, context);
  const account = await accounts.findById(context.companyId, rule.accountId);
  if (account === null) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.accountMappingMissing, "rule.accountId");
  }
  if (
    typeof account !== "object"
    || account.accountId !== rule.accountId
    || account.companyId !== context.companyId
  ) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.accountInvalid, "account");
  }
  if (account.status !== "active" || account.postingAllowed !== true) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.accountNotPostable, "account");
  }

  return Object.freeze({
    ruleId: rule.ruleId,
    accountRole: rule.accountRole,
    account: Object.freeze({ ...account }),
  });
}
