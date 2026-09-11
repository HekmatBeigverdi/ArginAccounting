import { IRR, normalizeCurrencyCode, type CurrencyCode } from "@argin/platform";
import type { InventoryValuationMethod } from "./inventory-valuation.ts";
import { INVENTORY_VALUATION_METHODS } from "./inventory-valuation.ts";
import { INVENTORY_VALUATION_STRATEGY_VERSION } from "./inventory-valuation-strategy.ts";

export type InventoryValuationPolicyErrorCode =
  | "VALUATION_POLICY_INPUT_INVALID"
  | "VALUATION_POLICY_ID_REQUIRED"
  | "VALUATION_POLICY_METHOD_INVALID"
  | "VALUATION_POLICY_VERSION_INVALID"
  | "VALUATION_POLICY_EFFECTIVE_DATE_INVALID"
  | "VALUATION_POLICY_OVERLAP"
  | "VALUATION_POLICY_NOT_FOUND"
  | "VALUATION_POLICY_DIRECT_MUTATION_LOCKED"
  | "VALUATION_POLICY_TRANSITION_INVALID";

export class InventoryValuationPolicyError extends Error {
  constructor(
    public readonly code: InventoryValuationPolicyErrorCode,
    public readonly field: string,
  ) {
    super(`${code}:${field}`);
    this.name = "InventoryValuationPolicyError";
  }
}

export interface InventoryValuationPolicySnapshot {
  readonly policyId: string;
  readonly companyId: string;
  readonly method: InventoryValuationMethod;
  readonly strategyVersion: number;
  readonly currency: CurrencyCode;
  readonly effectiveFrom: string;
  readonly previousPolicyId: string | null;
  readonly changeReason: string | null;
  readonly revision: number;
}

export interface InventoryValuationPolicyResolutionContext {
  readonly companyId: string;
  readonly productId: string;
  readonly warehouseId: string;
  readonly businessDate: string;
}

export interface InventoryValuationPolicyResolution {
  readonly policy: InventoryValuationPolicySnapshot;
  readonly companyId: string;
  readonly productId: string;
  readonly warehouseId: string;
}

const fail = (code: InventoryValuationPolicyErrorCode, field: string): never => {
  throw new InventoryValuationPolicyError(code, field);
};

function requiredId(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail("VALUATION_POLICY_ID_REQUIRED", field);
  return value.trim();
}

function normalizeDate(value: string, field: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return fail("VALUATION_POLICY_EFFECTIVE_DATE_INVALID", field);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return fail("VALUATION_POLICY_EFFECTIVE_DATE_INVALID", field);
  }
  return value;
}

function normalizeMethod(value: InventoryValuationMethod): InventoryValuationMethod {
  if (!INVENTORY_VALUATION_METHODS.includes(value)) return fail("VALUATION_POLICY_METHOD_INVALID", "method");
  return value;
}

function normalizeVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) return fail("VALUATION_POLICY_VERSION_INVALID", "strategyVersion");
  return value;
}

function normalizeRevision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) return fail("VALUATION_POLICY_INPUT_INVALID", "revision");
  return value;
}

function normalizeCurrency(value: CurrencyCode | undefined): CurrencyCode {
  try {
    return normalizeCurrencyCode(value ?? IRR.code);
  } catch {
    return fail("VALUATION_POLICY_INPUT_INVALID", "currency");
  }
}

function normalizeReason(value: string | undefined, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail("VALUATION_POLICY_TRANSITION_INVALID", field);
  return value.trim();
}

export function createInitialInventoryValuationPolicy(input: {
  readonly policyId: string;
  readonly companyId: string;
  readonly method: InventoryValuationMethod;
  readonly strategyVersion?: number;
  readonly currency?: CurrencyCode;
  readonly effectiveFrom: string;
}): InventoryValuationPolicySnapshot {
  if (!input || typeof input !== "object") return fail("VALUATION_POLICY_INPUT_INVALID", "policy");
  return Object.freeze({
    policyId: requiredId(input.policyId, "policyId"),
    companyId: requiredId(input.companyId, "companyId"),
    method: normalizeMethod(input.method),
    strategyVersion: normalizeVersion(input.strategyVersion ?? INVENTORY_VALUATION_STRATEGY_VERSION),
    currency: normalizeCurrency(input.currency),
    effectiveFrom: normalizeDate(input.effectiveFrom, "effectiveFrom"),
    previousPolicyId: null,
    changeReason: null,
    revision: 1,
  });
}

export function createInventoryValuationPolicyTransition(input: {
  readonly policyId: string;
  readonly current: InventoryValuationPolicySnapshot;
  readonly method: InventoryValuationMethod;
  readonly strategyVersion?: number;
  readonly currency?: CurrencyCode;
  readonly effectiveFrom: string;
  readonly changeReason: string;
}): InventoryValuationPolicySnapshot {
  if (!input || typeof input !== "object" || !input.current) return fail("VALUATION_POLICY_INPUT_INVALID", "transition");

  const effectiveFrom = normalizeDate(input.effectiveFrom, "effectiveFrom");
  if (effectiveFrom <= input.current.effectiveFrom) return fail("VALUATION_POLICY_TRANSITION_INVALID", "effectiveFrom");

  return Object.freeze({
    policyId: requiredId(input.policyId, "policyId"),
    companyId: requiredId(input.current.companyId, "companyId"),
    method: normalizeMethod(input.method),
    strategyVersion: normalizeVersion(input.strategyVersion ?? INVENTORY_VALUATION_STRATEGY_VERSION),
    currency: normalizeCurrency(input.currency ?? input.current.currency),
    effectiveFrom,
    previousPolicyId: requiredId(input.current.policyId, "previousPolicyId"),
    changeReason: normalizeReason(input.changeReason, "changeReason"),
    revision: input.current.revision + 1,
  });
}

export function assertDirectInventoryValuationPolicyMutationAllowed(input: {
  readonly hasAuthoritativeValuation: boolean;
}): void {
  if (input.hasAuthoritativeValuation) return fail("VALUATION_POLICY_DIRECT_MUTATION_LOCKED", "method");
}

export function resolveInventoryValuationPolicy(
  policies: readonly InventoryValuationPolicySnapshot[],
  context: InventoryValuationPolicyResolutionContext,
): InventoryValuationPolicyResolution {
  const companyId = requiredId(context.companyId, "context.companyId");
  const productId = requiredId(context.productId, "context.productId");
  const warehouseId = requiredId(context.warehouseId, "context.warehouseId");
  const businessDate = normalizeDate(context.businessDate, "context.businessDate");

  const eligible = policies
    .filter((policy) => policy.companyId === companyId && policy.effectiveFrom <= businessDate)
    .sort((left, right) => {
      const dateDelta = right.effectiveFrom.localeCompare(left.effectiveFrom);
      if (dateDelta !== 0) return dateDelta;
      return right.revision - left.revision;
    });

  const selected = eligible[0];
  if (!selected) return fail("VALUATION_POLICY_NOT_FOUND", "companyId");

  const overlap = eligible.find(
    (candidate, index) => index > 0 && candidate.effectiveFrom === selected.effectiveFrom,
  );
  if (overlap) return fail("VALUATION_POLICY_OVERLAP", "effectiveFrom");

  return Object.freeze({ policy: selected, companyId, productId, warehouseId });
}

export function assertInventoryValuationPolicyHistory(policies: readonly InventoryValuationPolicySnapshot[]): void {
  const byCompany = new Map<string, InventoryValuationPolicySnapshot[]>();
  for (const policy of policies) {
    const current = byCompany.get(policy.companyId) ?? [];
    current.push(policy);
    byCompany.set(policy.companyId, current);
  }

  for (const companyPolicies of byCompany.values()) {
    const ordered = [...companyPolicies].sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom));
    for (let index = 0; index < ordered.length; index += 1) {
      const policy = ordered[index];
      if (!policy) continue;
      const previous = index === 0 ? undefined : ordered[index - 1];
      if (!previous) {
        if (policy.previousPolicyId !== null) return fail("VALUATION_POLICY_TRANSITION_INVALID", "previousPolicyId");
        continue;
      }
      if (policy.effectiveFrom === previous.effectiveFrom) return fail("VALUATION_POLICY_OVERLAP", "effectiveFrom");
      if (policy.previousPolicyId !== previous.policyId) return fail("VALUATION_POLICY_TRANSITION_INVALID", "previousPolicyId");
    }
  }
}
