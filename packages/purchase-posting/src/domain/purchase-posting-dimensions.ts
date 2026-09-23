import type {
  AccountDimensionPolicy,
  AccountingDimensionAssignment,
  AccountingDimensionMember,
  AccountingDimensionType,
} from "@argin/accounting";
import {
  validateAccountingDimensionAssignments,
} from "@argin/accounting";

import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
} from "./purchase-posting-domain-errors.ts";
import type {
  PurchasePostingDomainErrorCode,
} from "./purchase-posting-domain-errors.ts";
import type {
  PurchasePostingFactSnapshot,
  PurchasePostingLineFactSnapshot,
} from "./purchase-posting-facts.ts";

export const PURCHASE_POSTING_DIMENSION_SOURCES = Object.freeze([
  "party",
  "product",
  "warehouse",
  "cost-center",
  "project",
] as const);

export type PurchasePostingDimensionSource =
  (typeof PURCHASE_POSTING_DIMENSION_SOURCES)[number];

export interface PurchasePostingDimensionReference {
  readonly source: PurchasePostingDimensionSource;
  readonly sourceReferenceId: string;
}

export interface PurchasePostingDimensionContext {
  readonly costCenterId?: string | null;
  readonly projectId?: string | null;
}

export interface PurchasePostingDimensionReader {
  findPoliciesForAccount(
    companyId: string,
    accountId: string,
  ): Promise<readonly AccountDimensionPolicy[]>;
  findTypesByCompanyId(
    companyId: string,
  ): Promise<readonly AccountingDimensionType[]>;
  resolveMemberBySource(
    companyId: string,
    source: PurchasePostingDimensionSource,
    sourceReferenceId: string,
  ): Promise<AccountingDimensionMember | null>;
  findMembersByIds(
    ids: readonly string[],
  ): Promise<readonly AccountingDimensionMember[]>;
}

export interface ResolvePurchasePostingDimensionsInput {
  readonly fact: PurchasePostingFactSnapshot;
  readonly sourceLineId: string | null;
  readonly accountId: string;
  readonly dimensionContext?: PurchasePostingDimensionContext | null;
}

const fail = (code: PurchasePostingDomainErrorCode, field: string): never => {
  throw new PurchasePostingDomainError(code, field);
};

function lineById(
  fact: PurchasePostingFactSnapshot,
  sourceLineId: string | null,
): PurchasePostingLineFactSnapshot | null {
  if (sourceLineId === null) return null;
  const line = fact.lines.find(item => item.purchaseLineId === sourceLineId);
  if (!line) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.dimensionResolutionInvalid, "sourceLineId");
  }
  return line;
}

function addReference(
  target: PurchasePostingDimensionReference[],
  source: PurchasePostingDimensionSource,
  value: string | null | undefined,
): void {
  if (value == null) return;
  const normalized = value.trim();
  if (normalized.length === 0) return;
  if (!target.some(item => item.source === source && item.sourceReferenceId === normalized)) {
    target.push(Object.freeze({ source, sourceReferenceId: normalized }));
  }
}

export function collectPurchasePostingDimensionReferences(
  fact: PurchasePostingFactSnapshot,
  sourceLineId: string | null,
  context?: PurchasePostingDimensionContext | null,
): readonly PurchasePostingDimensionReference[] {
  const references: PurchasePostingDimensionReference[] = [];
  addReference(references, "party", fact.supplier.supplierId);
  addReference(references, "cost-center", context?.costCenterId);
  addReference(references, "project", context?.projectId);

  const line = lineById(fact, sourceLineId);
  if (line !== null) {
    addReference(references, "product", line.item.itemId);
    for (const warehouseId of [...new Set(line.valuations.map(item => item.warehouseId))].sort()) {
      addReference(references, "warehouse", warehouseId);
    }
  }

  return Object.freeze(references);
}

export async function resolvePurchasePostingDimensionAssignments(
  input: ResolvePurchasePostingDimensionsInput,
  reader: PurchasePostingDimensionReader,
): Promise<readonly AccountingDimensionAssignment[]> {
  const policies = await reader.findPoliciesForAccount(
    input.fact.companyId,
    input.accountId,
  );
  const types = await reader.findTypesByCompanyId(input.fact.companyId);
  const typeById = new Map(types.map(type => [type.id, type]));
  const relevantPolicies = policies.filter(
    policy => policy.companyId === input.fact.companyId && policy.accountId === input.accountId,
  );

  const references = collectPurchasePostingDimensionReferences(
    input.fact,
    input.sourceLineId,
    input.dimensionContext,
  );

  const resolvedMembers: AccountingDimensionMember[] = [];
  for (const reference of references) {
    const member = await reader.resolveMemberBySource(
      input.fact.companyId,
      reference.source,
      reference.sourceReferenceId,
    );
    if (member === null) continue;
    if (
      member.companyId !== input.fact.companyId
      || member.sourceReferenceId !== reference.sourceReferenceId
      || !typeById.has(member.dimensionTypeId)
    ) {
      return fail(
        PURCHASE_POSTING_DOMAIN_ERROR_CODES.dimensionResolutionInvalid,
        reference.source,
      );
    }

    const policy = relevantPolicies.find(
      item => item.dimensionTypeId === member.dimensionTypeId,
    );
    if (policy === undefined || policy.requirement === "forbidden") {
      continue;
    }
    resolvedMembers.push(member);
  }

  const assignmentsByType = new Map<string, string[]>();
  for (const member of resolvedMembers) {
    const current = assignmentsByType.get(member.dimensionTypeId) ?? [];
    if (!current.includes(member.id)) current.push(member.id);
    assignmentsByType.set(member.dimensionTypeId, current);
  }

  for (const policy of relevantPolicies) {
    if (
      policy.requirement === "required"
      && (assignmentsByType.get(policy.dimensionTypeId)?.length ?? 0) === 0
    ) {
      return fail(
        PURCHASE_POSTING_DOMAIN_ERROR_CODES.dimensionRequiredMissing,
        policy.dimensionTypeId,
      );
    }
  }

  const assignments = Object.freeze(
    [...assignmentsByType.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([dimensionTypeId, memberIds]) => Object.freeze({
        dimensionTypeId,
        memberIds: Object.freeze([...memberIds].sort()),
      })),
  );

  const members = await reader.findMembersByIds(
    assignments.flatMap(item => item.memberIds),
  );
  const issues = validateAccountingDimensionAssignments({
    companyId: input.fact.companyId,
    accountId: input.accountId,
    documentDate: input.fact.businessDate,
    policies: relevantPolicies,
    dimensionTypes: types,
    members,
    assignments,
  });
  if (issues.length > 0) {
    return fail(
      PURCHASE_POSTING_DOMAIN_ERROR_CODES.dimensionValidationFailed,
      issues[0]?.dimensionTypeId ?? "dimensions",
    );
  }

  return assignments;
}
