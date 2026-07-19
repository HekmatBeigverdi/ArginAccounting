export type FiscalYearStatus =
  | "draft"
  | "open"
  | "closing"
  | "closed";

export interface FiscalYear {
  id: string;
  companyId: string;
  code: string;
  title: string;
  startDate: string;
  endDate: string;
  status: FiscalYearStatus;
  isCurrent: boolean;
  closedAt: string | null;
  closedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFiscalYearInput {
  companyId: string;
  code: string;
  title: string;
  startDate: string;
  endDate: string;
  createMonthlyPeriods: boolean;
  makeCurrent: boolean;
}
