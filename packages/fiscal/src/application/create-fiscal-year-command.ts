export interface FiscalPeriodDraft {
  sequence: number;
  code: string;
  title: string;
  startDate: string;
  endDate: string;
}

export interface CreateFiscalYearCommand {
  companyId: string;
  code: string;
  title: string;
  startDate: string;
  endDate: string;
  makeCurrent: boolean;
  periods: FiscalPeriodDraft[];
}
