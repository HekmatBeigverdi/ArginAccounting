import {
  isAuditAction,
  isAuditOutcome,
  isAuditSource
} from "@argin/audit";

import type {
  AuditActorType,
  AuditEntry,
  AuditMetadata,
  AuditSnapshot
} from "@argin/audit";

import type {
  AuditEntryRow
} from "./audit-entry-mapper.ts";

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

function parseSnapshot(
  value: string | null
): AuditSnapshot | null {
  if (value === null) {
    return null;
  }

  return JSON.parse(
    value
  ) as AuditSnapshot;
}

function parseMetadata(
  value: string | null
): AuditMetadata | null {
  if (value === null) {
    return null;
  }

  return JSON.parse(
    value
  ) as AuditMetadata;
}

export function mapRowToAuditEntry(
  row: AuditEntryRow
): AuditEntry {
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

    before: parseSnapshot(
      row.before_json
    ),

    after: parseSnapshot(
      row.after_json
    ),

    correlationId:
      row.correlation_id,

    metadata: parseMetadata(
      row.metadata_json
    )
  };
}
