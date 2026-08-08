export type CompanyStatus =
  | "active"
  | "inactive";

export const companyActivityTypes = [
  "service",
  "trading",
  "manufacturing",
  "custom"
] as const;

export type CompanyActivityType =
  (typeof companyActivityTypes)[number];

export interface Company {
  id: string;
  code: string;
  legalName: string;
  tradeName: string | null;
  nationalId: string | null;
  registrationNumber: string | null;
  activityType: CompanyActivityType;
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
  activityType: CompanyActivityType;
}
