import type {
  CreateFiscalPeriodInput,
  FiscalPeriod
} from "../domain/fiscal-period";

export interface FiscalPeriodRepository {
  create(
    input: CreateFiscalPeriodInput
  ): Promise<FiscalPeriod>;

  createMany(
    inputs: CreateFiscalPeriodInput[]
  ): Promise<FiscalPeriod[]>;

  findById(id: string): Promise<FiscalPeriod | null>;

  findByFiscalYearId(
    fiscalYearId: string
  ): Promise<FiscalPeriod[]>;

  findByDate(
    fiscalYearId: string,
    date: string
  ): Promise<FiscalPeriod | null>;

  updateStatus(
    periodId: string,
    status: FiscalPeriod["status"],
    lockReason: string | null,
    lockedBy: string | null,
    updatedAt: string
  ): Promise<void>;
}
