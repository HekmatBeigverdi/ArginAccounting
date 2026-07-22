import type {
  AuditEntry,
  AuditEntrySummary,
  AuditQuery,
  AuditQueryResult,
  AuditRepository
} from "@argin/audit";

import {
  mapAuditEntryToRow
} from "../mappers/audit-entry-mapper";

import {
  mapRowToAuditEntry
} from "../mappers/audit-entry-from-row";

export class SqliteAuditRepository
implements AuditRepository {

  constructor(
    private readonly db: any
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
?,
?,
?,
?,
?,
?,
?,
?,
?,
?,
?,
?,
?,
?,
?,
?,
?,
?,
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

      const rows =
        await this.db.select(
    `
    SELECT *
    FROM audit_entries
    WHERE id = ?
    LIMIT 1
    `,
    [id]
    );

      if (
        !rows ||
        rows.length === 0
      ) {
        return null;
      }

      return mapRowToAuditEntry(
        rows[0]
      );

    }

  async search(
    query: AuditQuery
  ): Promise<
AuditQueryResult<
AuditEntrySummary
>
> {

    throw new Error(
      "Will be implemented later."
    );

  }

}
