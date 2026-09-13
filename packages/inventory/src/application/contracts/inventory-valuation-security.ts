import type { InventoryResolvedInboundCostBasis } from "../../domain/inventory-inbound-cost.ts";
import type { InventoryValuationEntrySnapshot } from "../../domain/inventory-valuation.ts";
import type { InventoryValuationPolicySnapshot } from "../../domain/inventory-valuation-policy.ts";

export const inventoryValuationPermissions = Object.freeze({
  view: "inventory.valuation.view",
  policyManage: "inventory.valuation.policy.manage",
  costInputCorrect: "inventory.valuation.cost-input.correct",
  recalculate: "inventory.valuation.recalculate",
  resolve: "inventory.valuation.resolve",
  export: "inventory.valuation.export",
} as const);

export type InventoryValuationPermission =
  (typeof inventoryValuationPermissions)[keyof typeof inventoryValuationPermissions];

export interface InventoryValuationAuthorizationContext {
  readonly actorId: string;
  readonly companyId: string;
  readonly requestId: string;
  readonly correlationId: string;
}

export interface InventoryValuationAuthorizationPolicy {
  require(
    context: InventoryValuationAuthorizationContext,
    permission: InventoryValuationPermission,
  ): Promise<void>;
}

export type InventoryValuationAuditAction =
  | "inventory.valuation.policy.initial-set"
  | "inventory.valuation.policy.transition"
  | "inventory.valuation.cost-input.correct"
  | "inventory.valuation.resolve"
  | "inventory.valuation.recalculate"
  | "inventory.valuation.export";

export type InventoryValuationAuditTarget =
  | Readonly<{ entityType: "inventory-valuation-policy"; entityId: string }>
  | Readonly<{ entityType: "inventory-valuation-cost-input"; entityId: string }>
  | Readonly<{ entityType: "inventory-valuation-entry"; entityId: string }>
  | Readonly<{ entityType: "inventory-valuation-stream"; entityId: string }>;

export interface InventoryValuationAuditEvent {
  readonly action: InventoryValuationAuditAction;
  readonly actorId: string;
  readonly companyId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly occurredAt: string;
  readonly target: InventoryValuationAuditTarget;
  readonly reason: string | null;
  readonly before: Readonly<Record<string, unknown>> | null;
  readonly after: Readonly<Record<string, unknown>> | null;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
}

/**
 * Shared Audit adapter must persist append-only and de-duplicate successful replay by
 * action + requestId + target identity.
 */
export interface InventoryValuationAuditSink {
  record(event: InventoryValuationAuditEvent): Promise<void>;
}

export const INVENTORY_VALUATION_TRACE_NODE_KINDS = Object.freeze([
  "movement",
  "cost-input",
  "policy",
  "valuation-entry",
  "cost-layer",
  "recalculation",
] as const);

export type InventoryValuationTraceNodeKind =
  (typeof INVENTORY_VALUATION_TRACE_NODE_KINDS)[number];

export interface InventoryValuationTraceNode {
  readonly kind: InventoryValuationTraceNodeKind;
  readonly id: string;
  readonly label: string;
}

export interface InventoryValuationTraceLink {
  readonly from: InventoryValuationTraceNode;
  readonly to: InventoryValuationTraceNode;
  readonly relation:
    | "movement-costed-by"
    | "cost-input-valued-as"
    | "policy-applied-to"
    | "entry-created-layer"
    | "recalculation-rebuilt-entry";
}

export interface InventoryValuationTraceSnapshot {
  readonly companyId: string;
  readonly movementId: string;
  readonly productId: string;
  readonly policy: InventoryValuationPolicySnapshot;
  readonly costInput: InventoryResolvedInboundCostBasis | null;
  readonly entry: InventoryValuationEntrySnapshot | null;
  readonly links: readonly InventoryValuationTraceLink[];
}

const text = (value: string, field: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`VALUATION_TRACE_INPUT_INVALID:${field}`);
  return value.trim();
};

const node = (kind: InventoryValuationTraceNodeKind, id: string, label: string): InventoryValuationTraceNode =>
  Object.freeze({ kind, id: text(id, `${kind}Id`), label: text(label, `${kind}Label`) });

/**
 * Builds a persistence-neutral explainability chain for one movement.
 * It never mutates valuation state and is intentionally suitable for Step 16 reports
 * and Step 17 drill-down UI.
 */
export function createInventoryValuationTraceSnapshot(input: {
  readonly companyId: string;
  readonly movementId: string;
  readonly productId: string;
  readonly policy: InventoryValuationPolicySnapshot;
  readonly costInput: InventoryResolvedInboundCostBasis | null;
  readonly entry: InventoryValuationEntrySnapshot | null;
}): InventoryValuationTraceSnapshot {
  const companyId = text(input.companyId, "companyId");
  const movementId = text(input.movementId, "movementId");
  const productId = text(input.productId, "productId");
  if (input.policy.companyId !== companyId) throw new Error("VALUATION_TRACE_POLICY_COMPANY_MISMATCH");
  if (input.costInput && input.costInput.movementId !== movementId) throw new Error("VALUATION_TRACE_COST_INPUT_MISMATCH");
  if (input.entry && (input.entry.companyId !== companyId || input.entry.productId !== productId || input.entry.source.movementId !== movementId)) {
    throw new Error("VALUATION_TRACE_ENTRY_MISMATCH");
  }

  const movementNode = node("movement", movementId, movementId);
  const policyNode = node("policy", input.policy.policyId, `${input.policy.method}@${input.policy.strategyVersion}`);
  const links: InventoryValuationTraceLink[] = [];

  if (input.costInput) {
    const costNode = node("cost-input", input.costInput.basisLineId, input.costInput.basisLineId);
    links.push(Object.freeze({ from: movementNode, to: costNode, relation: "movement-costed-by" as const }));
    if (input.entry) {
      const entryNode = node("valuation-entry", input.entry.valuationEntryId, input.entry.valuationEntryId);
      links.push(Object.freeze({ from: costNode, to: entryNode, relation: "cost-input-valued-as" as const }));
      links.push(Object.freeze({ from: policyNode, to: entryNode, relation: "policy-applied-to" as const }));
    }
  } else if (input.entry) {
    const entryNode = node("valuation-entry", input.entry.valuationEntryId, input.entry.valuationEntryId);
    links.push(Object.freeze({ from: policyNode, to: entryNode, relation: "policy-applied-to" as const }));
  }

  return Object.freeze({
    companyId,
    movementId,
    productId,
    policy: Object.freeze({ ...input.policy }),
    costInput: input.costInput ? Object.freeze({ ...input.costInput, allocations: Object.freeze(input.costInput.allocations.map(item => Object.freeze({ ...item }))) }) : null,
    entry: input.entry ? Object.freeze({ ...input.entry, stockKey: Object.freeze({ ...input.entry.stockKey }), source: Object.freeze({ ...input.entry.source }) }) : null,
    links: Object.freeze(links),
  });
}
