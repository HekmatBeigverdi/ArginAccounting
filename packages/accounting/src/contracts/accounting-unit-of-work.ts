import type { AccountCodingSettingsRepository } from "./account-coding-settings-repository.ts";
import type { AccountDimensionPolicyRepository } from "./account-dimension-policy-repository.ts";
import type { AccountRepository } from "./account-repository.ts";
import type { AccountingDimensionMemberRepository } from "./accounting-dimension-member-repository.ts";
import type { AccountingDimensionTypeRepository } from "./accounting-dimension-type-repository.ts";
import type {
  CodingTemplateApplicationHistoryRepository,
  CodingTemplateApplicationItemMappingRepository,
  CodingTemplateCompanyBaselineRepository,
  CodingTemplateImportHistoryRepository,
  CodingTemplateRepository,
  CodingTemplateVersionRepository,
} from "./coding-template-repositories.ts";

export interface AccountingUnitOfWorkRepositories {
  readonly accounts: AccountRepository;
  readonly codingSettings: AccountCodingSettingsRepository;
  /** Implemented by the Phase 11 SQLite adapter in step 11.9. */
  readonly dimensionTypes?: AccountingDimensionTypeRepository;
  /** Implemented by the Phase 11 SQLite adapter in step 11.9. */
  readonly dimensionMembers?: AccountingDimensionMemberRepository;
  /** Implemented by the Phase 11 SQLite adapter in step 11.9. */
  readonly dimensionPolicies?: AccountDimensionPolicyRepository;
  /** Implemented by the Phase 12 persistence adapters in step 14. */
  readonly codingTemplates?: CodingTemplateRepository;
  readonly codingTemplateVersions?: CodingTemplateVersionRepository;
  readonly codingTemplateApplications?: CodingTemplateApplicationHistoryRepository;
  readonly codingTemplateApplicationMappings?: CodingTemplateApplicationItemMappingRepository;
  readonly codingTemplateBaselines?: CodingTemplateCompanyBaselineRepository;
  readonly codingTemplateImports?: CodingTemplateImportHistoryRepository;
}

export interface AccountingUnitOfWork {
  run<T>(
    operation: (
      repositories: AccountingUnitOfWorkRepositories,
    ) => Promise<T>,
  ): Promise<T>;
}
