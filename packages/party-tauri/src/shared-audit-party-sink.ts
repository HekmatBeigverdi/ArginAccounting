import {
  recordAuditEntry,
  type AuditAction,
  type AuditCommandContext,
  type AuditSource
} from "@argin/audit";
import type { PartyAuditAction, PartyAuditEvent, PartyAuditSink } from "@argin/party";

export class SharedAuditPartySink implements PartyAuditSink {
  constructor(
    private readonly context: AuditCommandContext,
    private readonly source: AuditSource = "desktop"
  ) {}

  async record(event: PartyAuditEvent): Promise<void> {
    await recordAuditEntry(this.context, {
      occurredAt: event.occurredAt,
      action: mapAction(event.action),
      source: this.source,
      actor: {
        type: "user",
        id: event.actorId,
        displayName: event.actorId
      },
      scope: {
        companyId: event.companyId,
        branchId: null,
        fiscalYearId: null
      },
      target: {
        entityType: "party",
        entityId: event.partyId,
        entityDisplayName: null
      },
      correlationId: event.correlationId,
      metadata: {
        requestId: event.requestId,
        partyAction: event.action,
        ...event.metadata
      }
    });
  }
}

function mapAction(action: PartyAuditAction): AuditAction {
  switch (action) {
    case "party.create": return "create";
    case "party.update": return "update";
    case "party.change-status": return "status-change";
    case "party.add-role": return "assign";
    case "party.remove-role": return "unassign";
    case "party.import": return "import";
    case "party.export": return "export";
  }
}
