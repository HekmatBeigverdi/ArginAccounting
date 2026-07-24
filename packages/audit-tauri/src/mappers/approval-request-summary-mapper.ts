import type {
  ApprovalRequestSummary
} from "@argin/audit";

import type {
  ApprovalRequestRow
} from "./approval-request-mapper";

import {
  parseApprovalStatus
} from "./approval-value-parsers";

export function mapRowToApprovalRequestSummary(
  row: ApprovalRequestRow
): ApprovalRequestSummary {
  return {
    id:
      row.id,

    version:
      row.version,

    requestType:
      row.request_type,

    title:
      row.title,

    status:
      parseApprovalStatus(
        row.status
      ),

    entityType:
      row.entity_type,

    entityId:
      row.entity_id,

    entityDisplayName:
      row.entity_display_name,

    requestedById:
      row.requested_by_id,

    requestedByDisplayName:
      row.requested_by_name,

    requestedAt:
      row.requested_at,

    decidedById:
      row.decided_by_id,

    decidedByDisplayName:
      row.decided_by_name,

    decidedAt:
      row.decided_at,

    companyId:
      row.company_id,

    branchId:
      row.branch_id,

    fiscalYearId:
      row.fiscal_year_id,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  };
}
