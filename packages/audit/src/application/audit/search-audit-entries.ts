import type {
  AuditEntrySummary
} from "../../domain/audit-entry-summary";

import type {
  AuditQuery,
  AuditQueryResult
} from "../../domain/audit-query";

import type {
  AuditRepository
} from "../../contracts/audit-repository";

export function searchAuditEntries(
  auditRepository: AuditRepository,
  query: AuditQuery
): Promise<AuditQueryResult<AuditEntrySummary>> {
  return auditRepository.search(query);
}
