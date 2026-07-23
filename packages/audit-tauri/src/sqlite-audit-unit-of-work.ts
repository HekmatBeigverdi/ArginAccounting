import type {
  AuditRepositories,
  AuditUnitOfWork
} from "@argin/audit";

import type {
  SqliteDatabase
} from "./database";

import {
  SqliteApprovalRepository
} from "./repositories/sqlite-approval-repository";

import {
  SqliteAuditRepository
} from "./repositories/sqlite-audit-repository";

export class SqliteAuditUnitOfWork
implements AuditUnitOfWork {

  constructor(
    private readonly db:
      SqliteDatabase
  ) {}

  async transaction<T>(
    action: (
      repositories:
        AuditRepositories
    ) => Promise<T>
  ): Promise<T> {

    await this.db.beginTransaction();

    try {

      const repositories: AuditRepositories = {

        audit:
          new SqliteAuditRepository(
            this.db
          ),

        approval:
          new SqliteApprovalRepository(
            this.db
          )

      };

      const result =
        await action(
          repositories
        );

      await this.db.commit();

      return result;

    }
    catch (error) {

      await this.db.rollback();

      throw error;

    }

  }

}
