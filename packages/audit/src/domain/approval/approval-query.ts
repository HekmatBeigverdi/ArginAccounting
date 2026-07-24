import type {
  ApprovalStatus
} from "./approval-status.ts";

export interface ApprovalQuery {
  text?: string;

  requestType?: string;
  status?: ApprovalStatus;

  entityType?: string;
  entityId?: string;

  requestedById?: string;
  decidedById?: string;

  companyId?: string;
  branchId?: string;
  fiscalYearId?: string;

  createdFrom?: string;
  createdTo?: string;

  offset?: number;
  limit?: number;
}

export interface ApprovalQueryResult<T> {
  items: T[];
  totalCount: number;
  offset: number;
  limit: number;
}
