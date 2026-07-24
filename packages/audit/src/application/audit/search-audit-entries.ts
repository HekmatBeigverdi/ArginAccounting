import type {
  AuditEntrySummary
} from "../../domain/audit-entry-summary.ts";

import type {
  AuditQuery,
  AuditQueryResult
} from "../../domain/audit-query.ts";

import {
  auditPermissions,
  requireAuditPermission
} from "../audit-permissions.ts";

import type {
  AuditCommandContext
} from "./audit-command-context.ts";

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
