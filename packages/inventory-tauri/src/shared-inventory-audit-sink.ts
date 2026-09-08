import {
  recordAuditEntry,
  type AuditAction,
  type AuditCommandContext,
} from "@argin/audit";
import type { InventoryAuditAction, InventoryAuditEvent, InventoryAuditSink } from "@argin/inventory";

const auditAction = (action: InventoryAuditAction): AuditAction => {
  switch (action) {
    case "inventory.document.submit": return "submit";
    case "inventory.document.approve": return "approve";
    case "inventory.document.cancel": return "cancel";
    case "inventory.document.export": return "export";
    case "inventory.document.import": return "import";
    case "inventory.document.confirm":
    case "inventory.document.reverse":
      return "status-change";
  }
};

const deterministicId = (event: InventoryAuditEvent): string =>
  `inventory:${event.action}:${event.requestId}:${event.documentId}`;

export class SharedInventoryAuditSink implements InventoryAuditSink {
  constructor(private readonly context: AuditCommandContext) {}

  async record(event: InventoryAuditEvent): Promise<void> {
    const id = deterministicId(event);
    if (await this.context.auditRepository.findById(id)) return;
    await recordAuditEntry(this.context, {
      id,
      occurredAt: event.occurredAt,
      action: auditAction(event.action),
      outcome: "success",
      source: "desktop",
      actor: { type: "user", id: event.actorId, displayName: event.actorId },
      scope: { companyId: event.companyId, branchId: event.branchId, fiscalYearId: null },
      target: { entityType: "inventory-document", entityId: event.documentId, entityDisplayName: null },
      message: event.action,
      reason: event.reason,
      before: event.beforeStatus === null ? null : { status: event.beforeStatus },
      after: event.afterStatus === null ? null : { status: event.afterStatus },
      correlationId: event.correlationId,
      metadata: {
        requestId: event.requestId,
        inventoryAction: event.action,
        ...event.metadata,
      },
    });
  }
}
