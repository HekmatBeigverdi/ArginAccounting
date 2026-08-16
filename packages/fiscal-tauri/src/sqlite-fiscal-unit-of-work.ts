import type {
  FiscalUnitOfWork,
  FiscalUnitOfWorkRepositories
} from "@argin/fiscal";

import type {
  DatabaseExecutor,
  DatabaseSession
} from "@argin/database";

import {
  SqliteFiscalPeriodRepository
} from "./repositories/sqlite-fiscal-period-repository.ts";

import {
  SqliteFiscalYearRepository
} from "./repositories/sqlite-fiscal-year-repository.ts";

import {
  SqliteHistoricalLockRepository
} from "./repositories/sqlite-historical-lock-repository.ts";

import {
  SqliteNumberSeriesRepository
} from "./repositories/sqlite-number-series-repository.ts";

function createRepositories(
  database: DatabaseSession
): FiscalUnitOfWorkRepositories {
  return {
    fiscalYears:
      new SqliteFiscalYearRepository(database),
    fiscalPeriods:
      new SqliteFiscalPeriodRepository(database),
    historicalLocks:
      new SqliteHistoricalLockRepository(database),
    numberSeries:
      new SqliteNumberSeriesRepository(database)
  };
}

export class SqliteFiscalUnitOfWork
  implements FiscalUnitOfWork {
  constructor(
    private readonly database: DatabaseExecutor
  ) {}

  async run<T>(
    operation: (
      repositories: FiscalUnitOfWorkRepositories
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
