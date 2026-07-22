import type {
  AuditEntry
} from "@argin/audit";

import type {
  AuditEntryRow
} from "./audit-entry-mapper";

export function mapRowToAuditEntry(
  row: AuditEntryRow
): AuditEntry {

  return {

    id: row.id,

    occurredAt:
      row.occurred_at,

    action:
      row.action as any,

    outcome:
      row.outcome as any,

    source:
      row.source as any,

    actor: {

      type:
        row.actor_type as any,

      id:
        row.actor_id,

      displayName:
        row.actor_display_name

    },

    scope: {

      companyId:
        row.company_id,

      branchId:
        row.branch_id,

      fiscalYearId:
        row.fiscal_year_id

    },

    target: {

      entityType:
        row.entity_type,

      entityId:
        row.entity_id,

      entityDisplayName:
        row.entity_display_name

    },

    message:
      row.message,

    reason:
      row.reason,

    before:
      row.before_json
        ? JSON.parse(row.before_json)
        : null,

    after:
      row.after_json
        ? JSON.parse(row.after_json)
        : null,

    correlationId:
      row.correlation_id,

    metadata:
      row.metadata_json
        ? JSON.parse(row.metadata_json)
        : null

  };

}
