import type {
  AuditAction
} from "./audit-action";

import type {
  AuditActor
} from "./audit-actor";

import type {
  AuditOutcome
} from "./audit-outcome";

import type {
  AuditScope
} from "./audit-scope";

import type {
  AuditSource
} from "./audit-source";

import type {
  AuditTarget
} from "./audit-target";

export interface AuditEntrySummary {
  id: string;
  occurredAt: string;

  action: AuditAction;
  outcome: AuditOutcome;
  source: AuditSource;

  actor: AuditActor;
  scope: AuditScope;
  target: AuditTarget;

  message: string | null;
  reason: string | null;

  correlationId: string | null;
}
