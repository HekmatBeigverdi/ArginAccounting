import type {
  AuditEntry,
  AuditEntrySummary,
  AuditQuery,
  AuditQueryResult,
  AuditRepository
} from "@argin/audit";

import type {
  SqliteDatabase
} from "../database";

import {
  mapRowToAuditEntry
} from "../mappers/audit-entry-from-row";

import {
  mapAuditEntryToRow,
  type AuditEntryRow
} from "../mappers/audit-entry-mapper";

import {
  mapRowToAuditEntrySummary,
  type AuditEntrySummaryRow
} from "../mappers/audit-entry-summary-mapper";

import {
  AuditQueryBuilder
} from "../query";

interface AuditCountRow {
  total_count: number | string;
}

const DEFAULT_LIMIT = 50;
const MAXIMUM_LIMIT = 200;

function normalizeOffset(
  offset?: number
): number {
  if (
    offset === undefined ||
    !Number.isFinite(offset)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.trunc(offset)
  );
}

function normalizeLimit(
  limit?: number
): number {
  if (
    limit === undefined ||
    !Number.isFinite(limit)
  ) {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    MAXIMUM_LIMIT,
    Math.max(
      1,
      Math.trunc(limit)
    )
  );
}

function normalizeTotalCount(
  value: number | string | undefined
): number {
  const parsedValue =
    Number(value ?? 0);

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.max(
    0,
    Math.trunc(parsedValue)
  );
}

export class SqliteAuditRepository
implements AuditRepository {
  constructor(
    private readonly db:
      SqliteDatabase
  ) {}

  async create(
    entry: AuditEntry
  ): Promise<void> {
    const row =
      mapAuditEntryToRow(entry);

    await this.db.execute(
      `
INSERT INTO audit_entries
(
  id,
  occurred_at,
  action,
  outcome,
  source,
  actor_type,
  actor_id,
  actor_display_name,
  company_id,
  branch_id,
  fiscal_year_id,
  entity_type,
  entity_id,
  entity_display_name,
  message,
  reason,
  before_json,
  after_json,
  correlation_id,
  metadata_json
)
VALUES
(
  ?, ?, ?, ?, ?,
  ?, ?, ?,
  ?, ?, ?,
  ?, ?, ?,
  ?, ?,
  ?, ?,
  ?,
  ?
)
      `,
      [
        row.id,
        row.occurred_at,

        row.action,
        row.outcome,
        row.source,

        row.actor_type,
        row.actor_id,
        row.actor_display_name,

        row.company_id,
        row.branch_id,
        row.fiscal_year_id,

        row.entity_type,
        row.entity_id,
        row.entity_display_name,

        row.message,
        row.reason,

        row.before_json,
        row.after_json,

        row.correlation_id,
        row.metadata_json
      ]
    );
  }

  async findById(
    id: string
  ): Promise<AuditEntry | null> {
    const normalizedId = id.trim();

    if (!normalizedId) {
      return null;
    }

    const rows =
      await this.db.select<
        AuditEntryRow[]
      >(
        `
SELECT
  id,
  occurred_at,
  action,
  outcome,
  source,
  actor_type,
  actor_id,
  actor_display_name,
  company_id,
  branch_id,
  fiscal_year_id,
  entity_type,
  entity_id,
  entity_display_name,
  message,
  reason,
  before_json,
  after_json,
  correlation_id,
  metadata_json
FROM audit_entries
WHERE id = ?
LIMIT 1
        `,
        [normalizedId]
      );

    const row = rows[0];

    return row
      ? mapRowToAuditEntry(row)
      : null;
  }

  async search(
    query: AuditQuery
  ): Promise<
    AuditQueryResult<
      AuditEntrySummary
    >
  > {
    const offset =
      normalizeOffset(query.offset);

    const limit =
      normalizeLimit(query.limit);

    const builder =
      new AuditQueryBuilder()
        .whereAnyLike(
          [
            "actor_display_name",
            "entity_type",
            "entity_id",
            "entity_display_name",
            "message",
            "reason",
            "correlation_id"
          ],
          query.text
        )
        .whereEquals(
          "actor_id",
          query.actorId
        )
        .whereEquals(
          "actor_type",
          query.actorType
        )
        .whereEquals(
          "company_id",
          query.companyId
        )
        .whereEquals(
          "branch_id",
          query.branchId
        )
        .whereEquals(
          "fiscal_year_id",
          query.fiscalYearId
        )
        .whereEquals(
          "entity_type",
          query.entityType
        )
        .whereEquals(
          "entity_id",
          query.entityId
        )
        .whereEquals(
          "action",
          query.action
        )
        .whereEquals(
          "outcome",
          query.outcome
        )
        .whereEquals(
          "source",
          query.source
        )
        .whereEquals(
          "correlation_id",
          query.correlationId
        )
        .whereFrom(
          "occurred_at",
          query.occurredFrom
        )
        .whereTo(
          "occurred_at",
          query.occurredTo
        );

    const {
      whereSql,
      parameters
    } = builder.build();

    const countRows =
      await this.db.select<
        AuditCountRow[]
      >(
        `
SELECT COUNT(*) AS total_count
FROM audit_entries
${whereSql}
        `,
        parameters
      );

    const totalCount =
      normalizeTotalCount(
        countRows[0]?.total_count
      );

    if (
      totalCount === 0 ||
      offset >= totalCount
    ) {
      return {
        items: [],
        totalCount,
        offset,
        limit
      };
    }

    const rows =
      await this.db.select<
        AuditEntrySummaryRow[]
      >(
        `
SELECT
  id,
  occurred_at,
  action,
  outcome,
  source,
  actor_type,
  actor_id,
  actor_display_name,
  company_id,
  branch_id,
  fiscal_year_id,
  entity_type,
  entity_id,
  entity_display_name,
  message,
  reason,
  correlation_id
FROM audit_entries
${whereSql}
ORDER BY
  occurred_at DESC,
  id DESC
LIMIT ?
OFFSET ?
        `,
        [
          ...parameters,
          limit,
          offset
        ]
      );

    return {
      items: rows.map(
        mapRowToAuditEntrySummary
      ),
      totalCount,
      offset,
      limit
    };
  }
}
