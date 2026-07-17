import type {
  CompanyTaxProfile,
  CreateCompanyTaxProfileInput
} from "../domain/company-tax-profile";

export interface CompanyTaxProfileRepository {
  create(
    input: CreateCompanyTaxProfileInput
  ): Promise<CompanyTaxProfile>;

  findByCompanyId(
    companyId: string
  ): Promise<CompanyTaxProfile | null>;

  update(profile: CompanyTaxProfile): Promise<void>;
}
