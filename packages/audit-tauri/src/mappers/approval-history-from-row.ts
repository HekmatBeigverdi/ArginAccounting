import type {
  ApprovalHistoryEntry
} from "@argin/audit";

import type {
  ApprovalHistoryRow
} from "./approval-history-mapper.ts";

import {
  parseApprovalAction,
  parseApprovalActorType,
  parseApprovalStatus,
  parseNullableApprovalStatus
} from "./approval-value-parsers.ts";

export function mapRowToApprovalHistory(
  row: ApprovalHistoryRow
): ApprovalHistoryEntry {
  return {
    id: row.id,

    approvalRequestId:
      row.approval_request_id,

    action:
      parseApprovalAction(
        row.action
      ),

    fromStatus:
      parseNullableApprovalStatus(
        row.from_status
      ),

    toStatus:
      parseApprovalStatus(
        row.to_status
      ),

    actor: {
      type:
        parseApprovalActorType(
          row.actor_type
        ),

      id:
        row.actor_id,

      displayName:
        row.actor_display_name
    },

    comment:
      row.comment,

    occurredAt:
      row.occurred_at
  };
}
