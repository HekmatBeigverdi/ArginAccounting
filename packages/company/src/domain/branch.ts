export type BranchStatus =
  | "active"
  | "inactive";

export interface Branch {
  id: string;
  companyId: string;
  code: string;
  name: string;
  isHeadOffice: boolean;
  status: BranchStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchInput {
  companyId: string;
  code: string;
  name: string;
  isHeadOffice: boolean;
}
