import type {
  TaxpayerType
} from "../domain/company-tax-profile";

export interface CompanySetupInput {
  company: {
    code: string;
    legalName: string;
    tradeName?: string | null;
    nationalId?: string | null;
    registrationNumber?: string | null;
  };

  headOffice: {
    code: string;
    name: string;
  };

  address?: {
    province?: string | null;
    city?: string | null;
    addressLine: string;
    postalCode?: string | null;
    phone?: string | null;
  };

  taxProfile?: {
    economicCode?: string | null;
    fiscalId?: string | null;
    sellerBranchCode?: string | null;
    taxpayerType: TaxpayerType;
    isEnabled: boolean;
  };
}
