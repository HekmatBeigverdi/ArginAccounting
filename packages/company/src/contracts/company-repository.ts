import type {
  Company,
  CreateCompanyInput
} from "../domain/company";

export interface CompanyRepository {
  create(input: CreateCompanyInput): Promise<Company>;

  findById(id: string): Promise<Company | null>;

  findByCode(code: string): Promise<Company | null>;

  findAll(): Promise<Company[]>;

  update(company: Company): Promise<void>;
}
