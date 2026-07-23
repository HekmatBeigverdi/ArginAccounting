import type {
  ApprovalHistoryEntry
} from "@argin/audit";

export interface ApprovalHistoryRow {
  id: string;
  approval_request_id: string;

  action: string;

  from_status: string | null;
  to_status: string;

  actor_type: string;
  actor_id: string | null;
  actor_display_name: string;

  comment: string | null;
  occurred_at: string;
}

export function mapApprovalHistoryToRow(
  history: ApprovalHistoryEntry
): ApprovalHistoryRow {
  return {
    id: history.id,

    approval_request_id:
      history.approvalRequestId,

    action: history.action,

    from_status:
      history.fromStatus,

    to_status:
      history.toStatus,

    actor_type:
      history.actor.type,

    actor_id:
      history.actor.id,

    actor_display_name:
      history.actor.displayName,

    comment:
      history.comment,

    occurred_at:
      history.occurredAt
  };
}
