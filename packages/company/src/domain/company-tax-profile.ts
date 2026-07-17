export type TaxpayerType =
  | "legal"
  | "individual"
  | "civil-partnership"
  | "foreign";

export interface CompanyTaxProfile {
  id: string;
  companyId: string;
  economicCode: string | null;
  fiscalId: string | null;
  sellerBranchCode: string | null;
  taxpayerType: TaxpayerType;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyTaxProfileInput {
  companyId: string;
  economicCode?: string | null;
  fiscalId?: string | null;
  sellerBranchCode?: string | null;
  taxpayerType: TaxpayerType;
  isEnabled: boolean;
}
