import type {
  AuditRepositories,
  AuditUnitOfWork
} from "@argin/audit";

import {
  SqliteAuditRepository
} from "./repositories/sqlite-audit-repository";

export class SqliteAuditUnitOfWork
implements AuditUnitOfWork {

  constructor(
    private readonly db: any
  ) {}

  async transaction<T>(
    action: (
      repositories:
        AuditRepositories
    ) => Promise<T>
  ): Promise<T> {

    throw new Error(
      "Transaction implementation will be added later."
    );

  }

}
