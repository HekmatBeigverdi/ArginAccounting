import type {
  AuditAction
} from "./audit-action";

import type {
  AuditActor
} from "./audit-actor";

import type {
  AuditMetadata
} from "./audit-metadata";

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

import type {
  AuditSnapshot
} from "./audit-value";

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
