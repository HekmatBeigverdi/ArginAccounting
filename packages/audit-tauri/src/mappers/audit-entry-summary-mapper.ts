import {
  isAuditAction,
  isAuditOutcome,
  isAuditSource
} from "@argin/audit";

import type {
  AuditActorType,
  AuditEntrySummary
} from "@argin/audit";

export interface AuditEntrySummaryRow {
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

  correlation_id: string | null;
}

const auditActorTypes:
  readonly AuditActorType[] = [
    "user",
    "system",
    "integration"
  ];

function parseActorType(
  value: string
): AuditActorType {
  if (
    auditActorTypes.includes(
      value as AuditActorType
    )
  ) {
    return value as AuditActorType;
  }

  throw new Error(
    `Invalid audit actor type: ${value}`
  );
}

export function mapRowToAuditEntrySummary(
  row: AuditEntrySummaryRow
): AuditEntrySummary {
  if (!isAuditAction(row.action)) {
    throw new Error(
      `Invalid audit action: ${row.action}`
    );
  }

  if (!isAuditOutcome(row.outcome)) {
    throw new Error(
      `Invalid audit outcome: ${row.outcome}`
    );
  }

  if (!isAuditSource(row.source)) {
    throw new Error(
      `Invalid audit source: ${row.source}`
    );
  }

  return {
    id: row.id,
    occurredAt: row.occurred_at,

    action: row.action,
    outcome: row.outcome,
    source: row.source,

    actor: {
      type: parseActorType(
        row.actor_type
      ),
      id: row.actor_id,
      displayName:
        row.actor_display_name
    },

    scope: {
      companyId: row.company_id,
      branchId: row.branch_id,
      fiscalYearId:
        row.fiscal_year_id
    },

    target: {
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityDisplayName:
        row.entity_display_name
    },

    message: row.message,
    reason: row.reason,

    correlationId:
      row.correlation_id
  };
}
