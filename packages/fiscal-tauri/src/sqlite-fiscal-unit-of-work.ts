import type {
  FiscalUnitOfWork,
  FiscalUnitOfWorkRepositories
} from "@argin/fiscal";

import type {
  DatabaseExecutor
} from "@argin/database";

import {
  SqliteFiscalPeriodRepository
} from "./repositories/sqlite-fiscal-period-repository";

import {
  SqliteFiscalYearRepository
} from "./repositories/sqlite-fiscal-year-repository";

import {
  SqliteHistoricalLockRepository
} from "./repositories/sqlite-historical-lock-repository";

import {
  SqliteNumberSeriesRepository
} from "./repositories/sqlite-number-series-repository";

function createRepositories(
  database: DatabaseExecutor
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

  async transaction<T>(
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
