import type {
  AuditEntry
} from "../../domain/audit-entry";

import type {
  AuditRepository
} from "../../contracts/audit-repository";

import {
  AuditEntryNotFoundError
} from "./audit-entry-not-found-error";

export async function getAuditEntry(
  auditRepository: AuditRepository,
  auditEntryId: string
): Promise<AuditEntry> {
  const entry = await auditRepository.findById(
    auditEntryId
  );

  if (entry === null) {
    throw new AuditEntryNotFoundError(
      auditEntryId
    );
  }

  return entry;
}
