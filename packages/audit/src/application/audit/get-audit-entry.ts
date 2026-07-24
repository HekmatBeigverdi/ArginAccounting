import type {
  AuditEntry
} from "../../domain/audit-entry";

import {
  auditPermissions,
  requireAuditPermission
} from "../audit-permissions";

import type {
  AuditCommandContext
} from "./audit-command-context";

import {
  AuditEntryNotFoundError
} from "./audit-entry-not-found-error";

export async function getAuditEntry(
  context: AuditCommandContext,
  auditEntryId: string
): Promise<AuditEntry> {
  await requireAuditPermission(
    context.authorizer,
    auditPermissions.entriesView
  );

  const entry = await context.auditRepository.findById(
    auditEntryId
  );

  if (entry === null) {
    throw new AuditEntryNotFoundError(auditEntryId);
  }

  return entry;
}
