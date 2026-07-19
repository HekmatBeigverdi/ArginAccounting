import type {
  FiscalPeriodRepository
} from "./fiscal-period-repository";

import type {
  FiscalYearRepository
} from "./fiscal-year-repository";

import type {
  HistoricalLockRepository
} from "./historical-lock-repository";

import type {
  NumberSeriesRepository
} from "./number-series-repository";

export interface FiscalUnitOfWorkRepositories {
  fiscalYears: FiscalYearRepository;
  fiscalPeriods: FiscalPeriodRepository;
  historicalLocks: HistoricalLockRepository;
  numberSeries: NumberSeriesRepository;
}

export interface FiscalUnitOfWork {
  transaction<T>(
    operation: (
      repositories: FiscalUnitOfWorkRepositories
    ) => Promise<T>
  ): Promise<T>;
}
