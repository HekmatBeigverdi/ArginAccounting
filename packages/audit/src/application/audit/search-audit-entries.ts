import type {
  AuditEntrySummary
} from "../../domain/audit-entry-summary";

import type {
  AuditQuery,
  AuditQueryResult
} from "../../domain/audit-query";

import type {
  AuditCommandContext
} from "./audit-command-context";

export function searchAuditEntries(
  context: AuditCommandContext,
  query: AuditQuery
): Promise<AuditQueryResult<AuditEntrySummary>> {
  return context.auditRepository.search(query);
}
