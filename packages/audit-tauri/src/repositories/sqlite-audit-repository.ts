import type {
  AuditRepository,
  AuditEntry,
  AuditQuery,
  AuditQueryResult,
  AuditEntrySummary
} from "@argin/audit";

export class SqliteAuditRepository
implements AuditRepository {

  constructor(
    private readonly db: any
  ) {}

  async create(
    entry: AuditEntry
  ): Promise<void> {

    throw new Error(
      "Implementation will be added in next step."
    );

  }

  async findById(
    id: string
  ): Promise<AuditEntry | null> {

    throw new Error(
      "Implementation will be added in next step."
    );

  }

  async search(
    query: AuditQuery
  ): Promise<
      AuditQueryResult<
        AuditEntrySummary
      >
    > {

    throw new Error(
      "Implementation will be added in next step."
    );

  }

}
