export type NumberResetPolicy =
  | "never"
  | "fiscal-year"
  | "monthly";

export interface NumberSeries {
  id: string;
  companyId: string;
  branchId: string | null;
  fiscalYearId: string | null;
  entityType: string;
  code: string;
  prefix: string;
  suffix: string;
  nextNumber: number;
  paddingLength: number;
  resetPolicy: NumberResetPolicy;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNumberSeriesInput {
  companyId: string;
  branchId?: string | null;
  fiscalYearId?: string | null;
  entityType: string;
  code: string;
  prefix?: string;
  suffix?: string;
  startNumber?: number;
  paddingLength?: number;
  resetPolicy: NumberResetPolicy;
}
