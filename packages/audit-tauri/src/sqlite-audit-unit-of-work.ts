import type {
  AuditRepositories,
  AuditUnitOfWork
} from "@argin/audit";

import type {
  SqliteDatabase
} from "./database";

export class SqliteAuditUnitOfWork
implements AuditUnitOfWork {
  constructor(
    private readonly db:
      SqliteDatabase
  ) {
    void this.db;
  }

  async transaction<T>(
    _action: (
      repositories:
        AuditRepositories
    ) => Promise<T>
  ): Promise<T> {
    throw new Error(
      "Audit transaction support has not been implemented yet."
    );
  }
}
