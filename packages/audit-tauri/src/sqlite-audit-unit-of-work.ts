import type {
  AuditRepositories,
  AuditUnitOfWork
} from "@argin/audit";

import {
  AsyncMutex
} from "./data-access/index.ts";

import type {
  SqliteDatabase
} from "./database/index.ts";

import {
  SqliteApprovalRepository
} from "./repositories/sqlite-approval-repository.ts";

import {
  SqliteAuditRepository
} from "./repositories/sqlite-audit-repository.ts";

export class SqliteAuditUnitOfWork
implements AuditUnitOfWork {
  private readonly transactionMutex =
    new AsyncMutex();

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
    return this.transactionMutex
      .runExclusive(
        async () => {
          await this.db.execute(
            "BEGIN IMMEDIATE"
          );

          try {
            const repositories:
              AuditRepositories = {
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

            await this.db.execute(
              "COMMIT"
            );

            return result;
          } catch (error) {
            try {
              await this.db.execute(
                "ROLLBACK"
              );
            } catch (
              rollbackError
            ) {
              throw new AggregateError(
                [
                  error,
                  rollbackError
                ],
                "The audit transaction failed and rollback was unsuccessful."
              );
            }

            throw error;
          }
        }
      );
  }
}
