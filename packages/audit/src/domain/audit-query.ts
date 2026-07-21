import type {
  AuditAction
} from "./audit-action";

import type {
  AuditActorType
} from "./audit-actor";

import type {
  AuditOutcome
} from "./audit-outcome";

import type {
  AuditSource
} from "./audit-source";

export interface AuditQuery {
  text?: string;

  actorId?: string;
  actorType?: AuditActorType;

  companyId?: string;
  branchId?: string;
  fiscalYearId?: string;

  entityType?: string;
  entityId?: string;

  action?: AuditAction;
  outcome?: AuditOutcome;
  source?: AuditSource;

  occurredFrom?: string;
  occurredTo?: string;

  correlationId?: string;

  offset?: number;
  limit?: number;
}

export interface AuditQueryResult<T> {
  items: T[];
  totalCount: number;
  offset: number;
  limit: number;
}
