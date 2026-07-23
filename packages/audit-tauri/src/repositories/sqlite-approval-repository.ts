import type {
  ApprovalHistoryEntry,
  ApprovalQuery,
  ApprovalQueryResult,
  ApprovalRepository,
  ApprovalRequest,
  ApprovalRequestSummary
} from "@argin/audit";

import {
  executeSqlitePaginationQuery
} from "../data-access";

import type {
  SqliteDatabase
} from "../database";

import {
  mapRowToApprovalHistory
} from "../mappers/approval-history-from-row";

import {
  mapApprovalHistoryToRow,
  type ApprovalHistoryRow
} from "../mappers/approval-history-mapper";

import {
  mapRowToApprovalRequest
} from "../mappers/approval-request-from-row";

import {
  mapApprovalRequestToRow,
  type ApprovalRequestRow
} from "../mappers/approval-request-mapper";

import {
  mapRowToApprovalRequestSummary
} from "../mappers/approval-request-summary-mapper";

import {
  ApprovalQueryBuilder
} from "../query";

export class SqliteApprovalRepository
implements ApprovalRepository {
  constructor(
    private readonly db:
      SqliteDatabase
  ) {}

  async create(
    request: ApprovalRequest
  ): Promise<void> {
    const row =
      mapApprovalRequestToRow(request);

    await this.db.execute(
      `
INSERT INTO approval_requests
(
  id,
  request_type,
  title,
  description,
  status,
  entity_type,
  entity_id,
  entity_display_name,
  company_id,
  branch_id,
  fiscal_year_id,
  requested_by_type,
  requested_by_id,
  requested_by_name,
  requested_at,
  decided_by_type,
  decided_by_id,
  decided_by_name,
  decided_at,
  decision_comment,
  created_at,
  updated_at
)
VALUES
(
  ?, ?, ?, ?, ?,
  ?, ?, ?,
  ?, ?, ?,
  ?, ?, ?, ?,
  ?, ?, ?, ?, ?,
  ?, ?
)
      `,
      [
        row.id,

        row.request_type,
        row.title,
        row.description,

        row.status,

        row.entity_type,
        row.entity_id,
        row.entity_display_name,

        row.company_id,
        row.branch_id,
        row.fiscal_year_id,

        row.requested_by_type,
        row.requested_by_id,
        row.requested_by_name,
        row.requested_at,

        row.decided_by_type,
        row.decided_by_id,
        row.decided_by_name,
        row.decided_at,
        row.decision_comment,

        row.created_at,
        row.updated_at
      ]
    );
  }

  async update(
    request: ApprovalRequest
  ): Promise<void> {
    const row =
      mapApprovalRequestToRow(request);

    await this.db.execute(
      `
UPDATE approval_requests
SET
  request_type = ?,
  title = ?,
  description = ?,
  status = ?,
  entity_type = ?,
  entity_id = ?,
  entity_display_name = ?,
  company_id = ?,
  branch_id = ?,
  fiscal_year_id = ?,
  requested_by_type = ?,
  requested_by_id = ?,
  requested_by_name = ?,
  requested_at = ?,
  decided_by_type = ?,
  decided_by_id = ?,
  decided_by_name = ?,
  decided_at = ?,
  decision_comment = ?,
  updated_at = ?
WHERE id = ?
      `,
      [
        row.request_type,
        row.title,
        row.description,

        row.status,

        row.entity_type,
        row.entity_id,
        row.entity_display_name,

        row.company_id,
        row.branch_id,
        row.fiscal_year_id,

        row.requested_by_type,
        row.requested_by_id,
        row.requested_by_name,
        row.requested_at,

        row.decided_by_type,
        row.decided_by_id,
        row.decided_by_name,
        row.decided_at,
        row.decision_comment,

        row.updated_at,
        row.id
      ]
    );
  }

  async findById(
    id: string
  ): Promise<ApprovalRequest | null> {
    const normalizedId = id.trim();

    if (!normalizedId) {
      return null;
    }

    const requestRows =
      await this.db.select<
        ApprovalRequestRow[]
      >(
        `
SELECT
  id,
  request_type,
  title,
  description,
  status,
  entity_type,
  entity_id,
  entity_display_name,
  company_id,
  branch_id,
  fiscal_year_id,
  requested_by_type,
  requested_by_id,
  requested_by_name,
  requested_at,
  decided_by_type,
  decided_by_id,
  decided_by_name,
  decided_at,
  decision_comment,
  created_at,
  updated_at
FROM approval_requests
WHERE id = ?
LIMIT 1
        `,
        [normalizedId]
      );

    const requestRow =
      requestRows[0];

    if (!requestRow) {
      return null;
    }

    const historyRows =
      await this.db.select<
        ApprovalHistoryRow[]
      >(
        `
SELECT
  id,
  approval_request_id,
  action,
  from_status,
  to_status,
  actor_type,
  actor_id,
  actor_display_name,
  comment,
  occurred_at
FROM approval_history
WHERE approval_request_id = ?
ORDER BY
  occurred_at ASC,
  id ASC
        `,
        [normalizedId]
      );

    return mapRowToApprovalRequest(
      requestRow,
      historyRows.map(
        mapRowToApprovalHistory
      )
    );
  }
  async search(
    query: ApprovalQuery
  ): Promise<
    ApprovalQueryResult<
      ApprovalRequestSummary
    >
  > {
    const {
      whereSql,
      parameters
    } =
      new ApprovalQueryBuilder()
        .whereAnyLike(
          [
            "title",
            "description",
            "request_type",
            "entity_type",
            "entity_id",
            "entity_display_name",
            "requested_by_name",
            "decided_by_name",
            "decision_comment"
          ],
          query.text
        )
        .whereEquals(
          "request_type",
          query.requestType
        )
        .whereEquals(
          "status",
          query.status
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
          "requested_by_id",
          query.requestedById
        )
        .whereEquals(
          "decided_by_id",
          query.decidedById
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
        .whereFrom(
          "created_at",
          query.createdFrom
        )
        .whereTo(
          "created_at",
          query.createdTo
        )
        .build();

    return executeSqlitePaginationQuery<
      ApprovalRequestRow,
      ApprovalRequestSummary
    >({
      database: this.db,

      countSql: `
  SELECT COUNT(*) AS total_count
  FROM approval_requests
  ${whereSql}
      `,

      selectSql: `
  SELECT
    id,
    request_type,
    title,
    description,
    status,
    entity_type,
    entity_id,
    entity_display_name,
    company_id,
    branch_id,
    fiscal_year_id,
    requested_by_type,
    requested_by_id,
    requested_by_name,
    requested_at,
    decided_by_type,
    decided_by_id,
    decided_by_name,
    decided_at,
    decision_comment,
    created_at,
    updated_at
  FROM approval_requests
  ${whereSql}
  ORDER BY
    created_at DESC,
    id DESC
  LIMIT ?
  OFFSET ?
      `,

      parameters,
      ...(query.offset !== undefined && { offset: query.offset }),
      ...(query.limit !== undefined && { limit: query.limit }),

      mapRow:
        mapRowToApprovalRequestSummary
    });
  }  
  async addHistory(
    history: ApprovalHistoryEntry
  ): Promise<void> {
    const row =
      mapApprovalHistoryToRow(history);

    await this.db.execute(
      `
INSERT INTO approval_history
(
  id,
  approval_request_id,
  action,
  from_status,
  to_status,
  actor_type,
  actor_id,
  actor_display_name,
  comment,
  occurred_at
)
VALUES
(
  ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?
)
      `,
      [
        row.id,
        row.approval_request_id,

        row.action,

        row.from_status,
        row.to_status,

        row.actor_type,
        row.actor_id,
        row.actor_display_name,

        row.comment,
        row.occurred_at
      ]
    );
  }
}
