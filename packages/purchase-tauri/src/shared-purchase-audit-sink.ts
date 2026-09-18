import {
  recordAuditEntry,
  type AuditAction,
  type AuditCommandContext,
} from "@argin/audit";
import type { PurchaseAuditAction, PurchaseAuditEvent, PurchaseAuditSink } from "@argin/purchase";

const auditAction = (action: PurchaseAuditAction): AuditAction => {
  switch (action) {
    case "purchase.document.create": return "create";
    case "purchase.document.submit": return "submit";
    case "purchase.document.approve": return "approve";
    case "purchase.document.cancel": return "cancel";
    case "purchase.report.export": return "export";
    case "purchase.query.view": return "view";
    case "purchase.document.confirm":
    case "purchase.document.reopen":
    case "purchase.document.return":
    case "purchase.document.correct":
    case "purchase.inventory-receipt.stage":
    case "purchase.match.create":
    case "purchase.cost.resolve":
      return "status-change";
  }
};

const targetId = (event: PurchaseAuditEvent): string =>
  event.documentId ?? String(event.metadata.movementId ?? event.metadata.matchId ?? event.operationId);

const deterministicId = (event: PurchaseAuditEvent): string =>
  `purchase:${event.action}:${event.operationId}:${targetId(event)}`;

export class SharedPurchaseAuditSink implements PurchaseAuditSink {
  constructor(private readonly context: AuditCommandContext) {}

  async record(event: PurchaseAuditEvent): Promise<void> {
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
      target: {
        entityType: event.documentId ? "purchase-document" : "purchase-operation",
        entityId: targetId(event),
        entityDisplayName: null,
      },
      message: event.action,
      reason: event.reason,
      before: event.beforeStatus === null ? null : { status: event.beforeStatus },
      after: event.afterStatus === null ? null : { status: event.afterStatus },
      correlationId: event.correlationId,
      metadata: {
        requestId: event.requestId,
        operationId: event.operationId,
        purchaseAction: event.action,
        ...event.metadata,
      },
    });
  }
}
