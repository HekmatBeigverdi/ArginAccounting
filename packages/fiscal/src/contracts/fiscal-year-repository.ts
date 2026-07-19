import type {
  CreateFiscalYearInput,
  FiscalYear
} from "../domain/fiscal-year";

export interface FiscalYearRepository {
  create(input: CreateFiscalYearInput): Promise<FiscalYear>;

  findById(id: string): Promise<FiscalYear | null>;

  findByCompanyId(companyId: string): Promise<FiscalYear[]>;

  findCurrent(companyId: string): Promise<FiscalYear | null>;

  findOverlapping(
    companyId: string,
    startDate: string,
    endDate: string
  ): Promise<FiscalYear | null>;

  setCurrent(
    companyId: string,
    fiscalYearId: string
  ): Promise<void>;

  updateStatus(
    fiscalYearId: string,
    status: FiscalYear["status"],
    updatedAt: string
  ): Promise<void>;
}
