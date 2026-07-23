import type {
  ApprovalRequest
} from "@argin/audit";

export interface ApprovalRequestRow {
  id: string;

  request_type: string;
  title: string;
  description: string | null;

  status: string;

  entity_type: string;
  entity_id: string;
  entity_display_name: string | null;

  company_id: string | null;
  branch_id: string | null;
  fiscal_year_id: string | null;

  requested_by_type: string;
  requested_by_id: string | null;
  requested_by_name: string;

  requested_at: string | null;

  decided_by_type: string | null;
  decided_by_id: string | null;
  decided_by_name: string | null;

  decided_at: string | null;
  decision_comment: string | null;

  created_at: string;
  updated_at: string;
}

export function mapApprovalRequestToRow(
  request: ApprovalRequest
): ApprovalRequestRow {
  return {
    id: request.id,

    request_type: request.requestType,
    title: request.title,
    description: request.description,

    status: request.status,

    entity_type:
      request.target.entityType,

    entity_id:
      request.target.entityId,

    entity_display_name:
      request.target.entityDisplayName,

    company_id:
      request.scope.companyId,

    branch_id:
      request.scope.branchId,

    fiscal_year_id:
      request.scope.fiscalYearId,

    requested_by_type:
      request.requestedBy.type,

    requested_by_id:
      request.requestedBy.id,

    requested_by_name:
      request.requestedBy.displayName,

    requested_at:
      request.requestedAt,

    decided_by_type:
      request.decidedBy?.type ?? null,

    decided_by_id:
      request.decidedBy?.id ?? null,

    decided_by_name:
      request.decidedBy?.displayName ?? null,

    decided_at:
      request.decidedAt,

    decision_comment:
      request.decisionComment,

    created_at:
      request.createdAt,

    updated_at:
      request.updatedAt
  };
}
