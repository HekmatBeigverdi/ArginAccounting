export type {
  Company,
  CompanyStatus,
  CreateCompanyInput
} from "./domain/company";

export type {
  Branch,
  BranchStatus,
  CreateBranchInput
} from "./domain/branch";

export type {
  Address,
  AddressOwnerType,
  AddressType,
  CreateAddressInput
} from "./domain/address";

export type {
  CompanyTaxProfile,
  CreateCompanyTaxProfileInput,
  TaxpayerType
} from "./domain/company-tax-profile";

export type {
  CompanyRepository
} from "./contracts/company-repository";

export type {
  BranchRepository
} from "./contracts/branch-repository";

export type {
  AddressRepository
} from "./contracts/address-repository";

export type {
  CompanyTaxProfileRepository
} from "./contracts/company-tax-profile-repository";

export type {
  CompanyUnitOfWork,
  CompanyUnitOfWorkRepositories
} from "./contracts/company-unit-of-work";

export type {
  CompanySetupInput
} from "./application/company-setup-input";

export {
  setupCompany
} from "./application/setup-company";

export type {
  CompanySetupResult
} from "./application/setup-company";

export {
  CompanyValidationError
} from "./validation/company-validation-error";

export type {
  CompanyValidationIssue
} from "./validation/company-validation-error";
