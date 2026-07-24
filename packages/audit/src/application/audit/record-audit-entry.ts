import type {
  AuditEntry,
  CreateAuditEntryInput
} from "../../domain/audit-entry";

import {
  auditPermissions,
  requireAuditPermission
} from "../audit-permissions";

import type {
  AuditCommandContext
} from "./audit-command-context";

import {
  createAuditEntry
} from "./create-audit-entry";

export async function recordAuditEntry(
  context: AuditCommandContext,
  input: CreateAuditEntryInput
): Promise<AuditEntry> {
  await requireAuditPermission(
    context.authorizer,
    auditPermissions.entriesRecord
  );

  const entry = createAuditEntry(
    {
      idGenerator: context.idGenerator,
      clock: context.clock
    },
    input
  );

  await context.auditRepository.create(entry);
  return entry;
}
