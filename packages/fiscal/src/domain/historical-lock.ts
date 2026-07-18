export type HistoricalLockScope =
  | "all"
  | "accounting"
  | "sales"
  | "purchases"
  | "inventory"
  | "treasury"
  | "fixed-assets"
  | "payroll"
  | "manufacturing";

export interface HistoricalLock {
  id: string;
  companyId: string;
  branchId: string | null;
  scope: HistoricalLockScope;
  lockedThroughDate: string;
  reason: string;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  releasedBy: string | null;
  releasedAt: string | null;
}

export interface CreateHistoricalLockInput {
  companyId: string;
  branchId?: string | null;
  scope: HistoricalLockScope;
  lockedThroughDate: string;
  reason: string;
  createdBy?: string | null;
}
