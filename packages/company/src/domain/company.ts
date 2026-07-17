export type CompanyStatus =
  | "active"
  | "inactive";

export interface Company {
  id: string;
  code: string;
  legalName: string;
  tradeName: string | null;
  nationalId: string | null;
  registrationNumber: string | null;
  baseCurrency: "IRR";
  locale: "fa-IR";
  calendar: "jalali";
  status: CompanyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyInput {
  code: string;
  legalName: string;
  tradeName?: string | null;
  nationalId?: string | null;
  registrationNumber?: string | null;
}
