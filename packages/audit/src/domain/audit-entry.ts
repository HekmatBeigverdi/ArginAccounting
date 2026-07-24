import type {
  AuditAction
} from "./audit-action.ts";

import type {
  AuditActor
} from "./audit-actor.ts";

import type {
  AuditMetadata
} from "./audit-metadata.ts";

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

import type {
  AuditSnapshot
} from "./audit-value.ts";

export interface AuditEntry {
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

  before: AuditSnapshot | null;
  after: AuditSnapshot | null;

  correlationId: string | null;
  metadata: AuditMetadata | null;
}

export interface CreateAuditEntryInput {
  id?: string;
  occurredAt?: string;

  action: AuditAction;
  outcome?: AuditOutcome;
  source: AuditSource;

  actor: AuditActor;
  scope?: Partial<AuditScope>;
  target: AuditTarget;

  message?: string | null;
  reason?: string | null;

  before?: AuditSnapshot | null;
  after?: AuditSnapshot | null;

  correlationId?: string | null;
  metadata?: AuditMetadata | null;
}
