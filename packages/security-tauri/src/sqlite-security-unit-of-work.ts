import type {
  DatabaseExecutor
} from "@argin/database";

import type {
  SecurityUnitOfWork,
  SecurityUnitOfWorkRepositories
} from "@argin/security";

import {
  SqlitePermissionRepository
} from "./repositories/sqlite-permission-repository";

import {
  SqliteRoleRepository
} from "./repositories/sqlite-role-repository";

import {
  SqliteSecurityAssignmentRepository
} from "./repositories/sqlite-security-assignment-repository";

import {
  SqliteUserRepository
} from "./repositories/sqlite-user-repository";

function createRepositories(
  database: DatabaseExecutor
): SecurityUnitOfWorkRepositories {
  return {
    users:
      new SqliteUserRepository(database),
    roles:
      new SqliteRoleRepository(database),
    permissions:
      new SqlitePermissionRepository(database),
    assignments:
      new SqliteSecurityAssignmentRepository(
        database
      )
  };
}

export class SqliteSecurityUnitOfWork
  implements SecurityUnitOfWork {
  constructor(
    private readonly database: DatabaseExecutor
  ) {}

  async transaction<T>(
    operation: (
      repositories: SecurityUnitOfWorkRepositories
    ) => Promise<T>
  ): Promise<T> {
    return this.database.transaction(
      async (transactionDatabase) => {
        return operation(
          createRepositories(transactionDatabase)
        );
      }
    );
  }
}
