import type {
  AuditEntrySummary
} from "../../domain/audit-entry-summary";

import type {
  AuditQuery,
  AuditQueryResult
} from "../../domain/audit-query";

import {
  auditPermissions,
  requireAuditPermission
} from "../audit-permissions";

import type {
  AuditCommandContext
} from "./audit-command-context";

export async function searchAuditEntries(
  context: AuditCommandContext,
  query: AuditQuery
): Promise<AuditQueryResult<AuditEntrySummary>> {
  await requireAuditPermission(
    context.authorizer,
    auditPermissions.entriesView
  );

  return context.auditRepository.search(query);
}
