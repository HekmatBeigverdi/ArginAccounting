import type {
  AddressRepository
} from "./address-repository";

import type {
  BranchRepository
} from "./branch-repository";

import type {
  CompanyRepository
} from "./company-repository";

import type {
  CompanyTaxProfileRepository
} from "./company-tax-profile-repository";

export interface CompanyUnitOfWorkRepositories {
  companies: CompanyRepository;
  branches: BranchRepository;
  addresses: AddressRepository;
  taxProfiles: CompanyTaxProfileRepository;
}

export interface CompanyUnitOfWork {
  run<T>(
    operation: (
      repositories: CompanyUnitOfWorkRepositories
    ) => Promise<T>
  ): Promise<T>;
}
