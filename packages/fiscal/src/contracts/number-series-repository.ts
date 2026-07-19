import type {
  CreateNumberSeriesInput,
  NumberSeries
} from "../domain/number-series";

export interface NumberSeriesRepository {
  create(
    input: CreateNumberSeriesInput
  ): Promise<NumberSeries>;

  findByCode(
    companyId: string,
    code: string
  ): Promise<NumberSeries | null>;

  findApplicable(
    companyId: string,
    branchId: string | null,
    fiscalYearId: string | null,
    entityType: string
  ): Promise<NumberSeries | null>;

  reserveNext(
    seriesId: string
  ): Promise<{
    series: NumberSeries;
    reservedNumber: number;
  }>;
}
