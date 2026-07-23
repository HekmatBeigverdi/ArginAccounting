import type {
  AuditEntry
} from "@argin/audit";

export interface AuditEntryRow {
  id: string;
  occurred_at: string;

  action: string;
  outcome: string;
  source: string;

  actor_type: string;
  actor_id: string | null;
  actor_display_name: string;

  company_id: string | null;
  branch_id: string | null;
  fiscal_year_id: string | null;

  entity_type: string;
  entity_id: string | null;
  entity_display_name: string | null;

  message: string | null;
  reason: string | null;

  before_json: string | null;
  after_json: string | null;

  correlation_id: string | null;
  metadata_json: string | null;
}

export function mapAuditEntryToRow(
  entry: AuditEntry
): AuditEntryRow {
  return {
    id: entry.id,
    occurred_at: entry.occurredAt,

    action: entry.action,
    outcome: entry.outcome,
    source: entry.source,

    actor_type: entry.actor.type,
    actor_id: entry.actor.id,
    actor_display_name:
      entry.actor.displayName,

    company_id: entry.scope.companyId,
    branch_id: entry.scope.branchId,
    fiscal_year_id:
      entry.scope.fiscalYearId,

    entity_type:
      entry.target.entityType,
    entity_id:
      entry.target.entityId,
    entity_display_name:
      entry.target.entityDisplayName,

    message: entry.message,
    reason: entry.reason,

    before_json:
      entry.before === null
        ? null
        : JSON.stringify(entry.before),

    after_json:
      entry.after === null
        ? null
        : JSON.stringify(entry.after),

    correlation_id:
      entry.correlationId,

    metadata_json:
      entry.metadata === null
        ? null
        : JSON.stringify(entry.metadata)
  };
}
