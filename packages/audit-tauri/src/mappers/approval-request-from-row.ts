import type {
  ApprovalHistoryEntry,
  ApprovalRequest
} from "@argin/audit";

import type {
  ApprovalRequestRow
} from "./approval-request-mapper";

import {
  parseApprovalActorType,
  parseApprovalStatus
} from "./approval-value-parsers";

export function mapRowToApprovalRequest(
  row: ApprovalRequestRow,
  history: ApprovalHistoryEntry[]
): ApprovalRequest {
  const decidedBy =
    row.decided_by_type === null
      ? null
      : {
          type:
            parseApprovalActorType(
              row.decided_by_type
            ),

          id:
            row.decided_by_id,

          displayName:
            row.decided_by_name ?? ""
        };

  return {
    id:
      row.id,

    version:
      row.version,

    requestType:
      row.request_type,

    title:
      row.title,

    description:
      row.description,

    status:
      parseApprovalStatus(
        row.status
      ),

    target: {
      entityType:
        row.entity_type,

      entityId:
        row.entity_id,

      entityDisplayName:
        row.entity_display_name
    },

    scope: {
      companyId:
        row.company_id,

      branchId:
        row.branch_id,

      fiscalYearId:
        row.fiscal_year_id
    },

    requestedBy: {
      type:
        parseApprovalActorType(
          row.requested_by_type
        ),

      id:
        row.requested_by_id,

      displayName:
        row.requested_by_name
    },

    requestedAt:
      row.requested_at,

    decidedBy,

    decidedAt:
      row.decided_at,

    decisionComment:
      row.decision_comment,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,

    history
  };
}
