import type {
  ApprovalStatus
} from "./approval-status.ts";

export interface ApprovalRequestSummary {
  id: string;

  version: number;

  requestType: string;
  title: string;

  status: ApprovalStatus;

  entityType: string;
  entityId: string;
  entityDisplayName: string | null;

  requestedById: string | null;
  requestedByDisplayName: string | null;
  requestedAt: string | null;

  decidedById: string | null;
  decidedByDisplayName: string | null;
  decidedAt: string | null;

  companyId: string | null;
  branchId: string | null;
  fiscalYearId: string | null;

  createdAt: string;
  updatedAt: string;
}
