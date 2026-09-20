import {
  recordAuditEntry,
  type AuditAction,
  type AuditCommandContext,
  type AuditSnapshot,
  type AuditValue,
} from "@argin/audit";
import type {
  InventoryValuationAuditAction,
  InventoryValuationAuditEvent,
  InventoryValuationAuditSink,
} from "@argin/inventory/valuation-security";

const auditAction = (action: InventoryValuationAuditAction): AuditAction => {
  switch (action) {
    case "inventory.valuation.export": return "export";
    case "inventory.valuation.policy.initial-set": return "create";
    case "inventory.valuation.policy.transition":
    case "inventory.valuation.cost-input.correct": return "update";
    case "inventory.valuation.resolve":
    case "inventory.valuation.recalculate": return "status-change";
  }
};

const deterministicId = (event: InventoryValuationAuditEvent): string =>
  `inventory-valuation:${event.action}:${event.requestId}:${event.target.entityType}:${event.target.entityId}`;

const auditValue = (value: unknown): AuditValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(auditValue);
  if (typeof value === "object" && value !== null &&
      (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, auditValue(item)]));
  }
  throw new TypeError("Inventory valuation audit snapshots must contain only JSON-compatible values");
};

const auditSnapshot = (value: Readonly<Record<string, unknown>> | null): AuditSnapshot | null =>
  value === null ? null : Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, auditValue(item)]),
  );

/** Adapter over the shared Phase 8 append-only Audit engine. */
export class SharedInventoryValuationAuditSink implements InventoryValuationAuditSink {
  constructor(private readonly context: AuditCommandContext) {}

  async record(event: InventoryValuationAuditEvent): Promise<void> {
    const id = deterministicId(event);
    if (await this.context.auditRepository.findById(id)) return;
    await recordAuditEntry(this.context, {
      id,
      occurredAt: event.occurredAt,
      action: auditAction(event.action),
      outcome: "success",
      source: "desktop",
      actor: { type: "user", id: event.actorId, displayName: event.actorId },
      scope: { companyId: event.companyId, branchId: null, fiscalYearId: null },
      target: {
        entityType: event.target.entityType,
        entityId: event.target.entityId,
        entityDisplayName: null,
      },
      message: event.action,
      reason: event.reason,
      before: auditSnapshot(event.before),
      after: auditSnapshot(event.after),
      correlationId: event.correlationId,
      metadata: {
        requestId: event.requestId,
        valuationAction: event.action,
        ...event.metadata,
      },
    });
  }
}
