import type {
  AuditAction
} from "./audit-action.ts";

import type {
  AuditActor
} from "./audit-actor.ts";

import type {
  AuditOutcome
} from "./audit-outcome.ts";

import type {
  AuditScope
} from "./audit-scope.ts";

import type {
  AuditSource
} from "./audit-source.ts";

import type {
  AuditTarget
} from "./audit-target.ts";

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
