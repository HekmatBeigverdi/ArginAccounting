export interface ApprovalScope {
  companyId: string | null;
  branchId: string | null;
  fiscalYearId: string | null;
}

export const emptyApprovalScope: ApprovalScope = {
  companyId: null,
  branchId: null,
  fiscalYearId: null
};
