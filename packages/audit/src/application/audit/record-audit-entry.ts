import type {
  AuditEntry,
  CreateAuditEntryInput
} from "../../domain/audit-entry";

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
