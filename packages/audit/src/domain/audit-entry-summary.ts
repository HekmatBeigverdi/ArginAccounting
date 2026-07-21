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

export interface AuditEntrySummary {
  id: string;
  occurredAt: string;

  action: AuditAction;
  outcome: AuditOutcome;
  source: AuditSource;

  actorType: AuditActorType;
  actorId: string | null;
  actorDisplayName: string;

  entityType: string;
  entityId: string | null;
  entityDisplayName: string | null;

  companyId: string | null;
  branchId: string | null;
  fiscalYearId: string | null;

  message: string | null;
  correlationId: string | null;
}
