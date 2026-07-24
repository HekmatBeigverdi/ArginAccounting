import type {
  AuditEntry,
  AuditEntrySummary,
  AuditQuery,
  AuditQueryResult
} from "../index.ts";

export interface AuditRepository {

  create(
    entry: AuditEntry
  ): Promise<void>;

  findById(
    id: string
  ): Promise<AuditEntry | null>;

  search(
    query: AuditQuery
  ): Promise<
    AuditQueryResult<AuditEntrySummary>
  >;

}
