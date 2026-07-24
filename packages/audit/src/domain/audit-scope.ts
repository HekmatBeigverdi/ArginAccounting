export interface AuditScope {
  companyId: string | null;
  branchId: string | null;
  fiscalYearId: string | null;
}

export const emptyAuditScope: AuditScope = {
  companyId: null,
  branchId: null,
  fiscalYearId: null
};
