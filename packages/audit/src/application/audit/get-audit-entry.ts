import type {
  AuditEntry
} from "../../domain/audit-entry";

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
  const entry = await context.auditRepository.findById(
    auditEntryId
  );

  if (entry === null) {
    throw new AuditEntryNotFoundError(
      auditEntryId
    );
  }

  return entry;
}
