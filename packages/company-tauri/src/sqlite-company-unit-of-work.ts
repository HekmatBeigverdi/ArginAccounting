import type {
  CompanyUnitOfWork,
  CompanyUnitOfWorkRepositories
} from "@argin/company";

import type {
  DatabaseExecutor
} from "@argin/database";

import {
  SqliteAddressRepository
} from "./repositories/sqlite-address-repository";

import {
  SqliteBranchRepository
} from "./repositories/sqlite-branch-repository";

import {
  SqliteCompanyRepository
} from "./repositories/sqlite-company-repository";

import {
  SqliteCompanyTaxProfileRepository
} from "./repositories/sqlite-company-tax-profile-repository";

function createRepositories(
  database: DatabaseExecutor
): CompanyUnitOfWorkRepositories {
  return {
    companies: new SqliteCompanyRepository(database),
    branches: new SqliteBranchRepository(database),
    addresses: new SqliteAddressRepository(database),
    taxProfiles:
      new SqliteCompanyTaxProfileRepository(database)
  };
}

export class SqliteCompanyUnitOfWork
  implements CompanyUnitOfWork {
  constructor(
    private readonly database: DatabaseExecutor
  ) {}

  async transaction<T>(
    operation: (
      repositories: CompanyUnitOfWorkRepositories
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
