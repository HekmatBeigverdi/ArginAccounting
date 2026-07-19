export type FiscalPeriodStatus =
  | "open"
  | "locked"
  | "closed";

export interface FiscalPeriod {
  id: string;
  fiscalYearId: string;
  sequence: number;
  code: string;
  title: string;
  startDate: string;
  endDate: string;
  status: FiscalPeriodStatus;
  lockReason: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFiscalPeriodInput {
  fiscalYearId: string;
  sequence: number;
  code: string;
  title: string;
  startDate: string;
  endDate: string;
}
