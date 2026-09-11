import { IRR, normalizeCurrencyCode, type CurrencyCode } from "@argin/platform";
import type { InventoryValuationMethod } from "./inventory-valuation.ts";
import { INVENTORY_VALUATION_METHODS } from "./inventory-valuation.ts";
import { INVENTORY_VALUATION_STRATEGY_VERSION } from "./inventory-valuation-strategy.ts";

export const INVENTORY_VALUATION_POLICY_SCOPES = [
  "company",
  "product",
  "warehouse",
  "product_warehouse",
] as const;
export type InventoryValuationPolicyScope = (typeof INVENTORY_VALUATION_POLICY_SCOPES)[number];

export type InventoryValuationPolicyErrorCode =
  | "VALUATION_POLICY_INPUT_INVALID"
  | "VALUATION_POLICY_ID_REQUIRED"
  | "VALUATION_POLICY_SCOPE_INVALID"
  | "VALUATION_POLICY_METHOD_INVALID"
  | "VALUATION_POLICY_VERSION_INVALID"
  | "VALUATION_POLICY_EFFECTIVE_DATE_INVALID"
  | "VALUATION_POLICY_OVERLAP"
  | "VALUATION_POLICY_DEFAULT_MISSING"
  | "VALUATION_POLICY_HISTORICAL_CHANGE_REQUIRES_RECALCULATION";

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
  readonly scope: InventoryValuationPolicyScope;
  readonly productId: string | null;
  readonly warehouseId: string | null;
  readonly method: InventoryValuationMethod;
  readonly strategyVersion: number;
  readonly currency: CurrencyCode;
  readonly effectiveFrom: string;
  readonly revision: number;
}

export interface InventoryValuationPolicyContext {
  readonly companyId: string;
  readonly productId: string;
  readonly warehouseId: string;
  readonly businessDate: string;
}

export interface InventoryValuationPolicyResolution {
  readonly policy: InventoryValuationPolicySnapshot;
  readonly matchedScope: InventoryValuationPolicyScope;
}

export interface InventoryValuationPolicyChangeAssessment {
  readonly allowed: boolean;
  readonly requiresRecalculation: boolean;
  readonly changedValuationSemantics: boolean;
}

const fail = (code: InventoryValuationPolicyErrorCode, field: string): never => {
  throw new InventoryValuationPolicyError(code, field);
};

function requiredId(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail("VALUATION_POLICY_ID_REQUIRED", field);
  return value.trim();
}

function optionalId(value: string | null | undefined, field: string): string | null {
  if (value == null) return null;
  return requiredId(value, field);
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

function assertScopeReferences(
  scope: InventoryValuationPolicyScope,
  productId: string | null,
  warehouseId: string | null,
): void {
  const valid =
    (scope === "company" && productId === null && warehouseId === null) ||
    (scope === "product" && productId !== null && warehouseId === null) ||
    (scope === "warehouse" && productId === null && warehouseId !== null) ||
    (scope === "product_warehouse" && productId !== null && warehouseId !== null);
  if (!valid) fail("VALUATION_POLICY_SCOPE_INVALID", "scope");
}

export function createInventoryValuationPolicy(input: {
  readonly policyId: string;
  readonly companyId: string;
  readonly scope: InventoryValuationPolicyScope;
  readonly productId?: string | null;
  readonly warehouseId?: string | null;
  readonly method: InventoryValuationMethod;
  readonly strategyVersion?: number;
  readonly currency?: CurrencyCode;
  readonly effectiveFrom: string;
  readonly revision?: number;
}): InventoryValuationPolicySnapshot {
  if (!input || typeof input !== "object") return fail("VALUATION_POLICY_INPUT_INVALID", "policy");
  if (!INVENTORY_VALUATION_POLICY_SCOPES.includes(input.scope)) return fail("VALUATION_POLICY_SCOPE_INVALID", "scope");

  const productId = optionalId(input.productId, "productId");
  const warehouseId = optionalId(input.warehouseId, "warehouseId");
  assertScopeReferences(input.scope, productId, warehouseId);

  return Object.freeze({
    policyId: requiredId(input.policyId, "policyId"),
    companyId: requiredId(input.companyId, "companyId"),
    scope: input.scope,
    productId,
    warehouseId,
    method: normalizeMethod(input.method),
    strategyVersion: normalizeVersion(input.strategyVersion ?? INVENTORY_VALUATION_STRATEGY_VERSION),
    currency: normalizeCurrency(input.currency),
    effectiveFrom: normalizeDate(input.effectiveFrom, "effectiveFrom"),
    revision: normalizeRevision(input.revision ?? 1),
  });
}

function scopeRank(scope: InventoryValuationPolicyScope): number {
  switch (scope) {
    case "product_warehouse": return 4;
    case "product": return 3;
    case "warehouse": return 2;
    case "company": return 1;
  }
}

function matchesContext(policy: InventoryValuationPolicySnapshot, context: InventoryValuationPolicyContext): boolean {
  if (policy.companyId !== context.companyId || policy.effectiveFrom > context.businessDate) return false;
  if (policy.scope === "company") return true;
  if (policy.scope === "product") return policy.productId === context.productId;
  if (policy.scope === "warehouse") return policy.warehouseId === context.warehouseId;
  return policy.productId === context.productId && policy.warehouseId === context.warehouseId;
}

export function resolveInventoryValuationPolicy(
  policies: readonly InventoryValuationPolicySnapshot[],
  context: InventoryValuationPolicyContext,
): InventoryValuationPolicyResolution {
  const normalizedContext: InventoryValuationPolicyContext = {
    companyId: requiredId(context.companyId, "context.companyId"),
    productId: requiredId(context.productId, "context.productId"),
    warehouseId: requiredId(context.warehouseId, "context.warehouseId"),
    businessDate: normalizeDate(context.businessDate, "context.businessDate"),
  };

  const companyDefaults = policies.filter(
    (policy) => policy.companyId === normalizedContext.companyId && policy.scope === "company" && policy.effectiveFrom <= normalizedContext.businessDate,
  );
  if (companyDefaults.length === 0) return fail("VALUATION_POLICY_DEFAULT_MISSING", "company");

  const matches = policies.filter((policy) => matchesContext(policy, normalizedContext));
  matches.sort((left, right) => {
    const rankDelta = scopeRank(right.scope) - scopeRank(left.scope);
    if (rankDelta !== 0) return rankDelta;
    const dateDelta = right.effectiveFrom.localeCompare(left.effectiveFrom);
    if (dateDelta !== 0) return dateDelta;
    return right.revision - left.revision;
  });

  const selected = matches[0];
  if (!selected) return fail("VALUATION_POLICY_DEFAULT_MISSING", "company");

  const duplicate = matches.find(
    (candidate, index) => index > 0 &&
      candidate.scope === selected.scope &&
      candidate.effectiveFrom === selected.effectiveFrom &&
      candidate.productId === selected.productId &&
      candidate.warehouseId === selected.warehouseId,
  );
  if (duplicate) return fail("VALUATION_POLICY_OVERLAP", "effectiveFrom");

  return Object.freeze({ policy: selected, matchedScope: selected.scope });
}

export function assessInventoryValuationPolicyChange(input: {
  readonly current: InventoryValuationPolicySnapshot;
  readonly proposed: InventoryValuationPolicySnapshot;
  readonly hasValuationHistory: boolean;
  readonly latestValuedBusinessDate: string | null;
  readonly historicalRecalculationApproved?: boolean;
}): InventoryValuationPolicyChangeAssessment {
  if (input.current.policyId !== input.proposed.policyId || input.current.companyId !== input.proposed.companyId) {
    return fail("VALUATION_POLICY_INPUT_INVALID", "policyIdentity");
  }

  const semanticsChanged =
    input.current.method !== input.proposed.method ||
    input.current.strategyVersion !== input.proposed.strategyVersion ||
    input.current.currency !== input.proposed.currency ||
    input.current.scope !== input.proposed.scope ||
    input.current.productId !== input.proposed.productId ||
    input.current.warehouseId !== input.proposed.warehouseId;

  if (!input.hasValuationHistory || !semanticsChanged) {
    return Object.freeze({ allowed: true, requiresRecalculation: false, changedValuationSemantics: semanticsChanged });
  }

  const latest = input.latestValuedBusinessDate == null
    ? null
    : normalizeDate(input.latestValuedBusinessDate, "latestValuedBusinessDate");

  const historicalImpact = latest !== null && input.proposed.effectiveFrom <= latest;
  if (historicalImpact && !input.historicalRecalculationApproved) {
    return fail("VALUATION_POLICY_HISTORICAL_CHANGE_REQUIRES_RECALCULATION", "effectiveFrom");
  }

  return Object.freeze({
    allowed: true,
    requiresRecalculation: historicalImpact,
    changedValuationSemantics: true,
  });
}
