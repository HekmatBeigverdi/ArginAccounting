import type { AccountCodingSettingsRepository } from "./account-coding-settings-repository.ts";
import type { AccountDimensionPolicyRepository } from "./account-dimension-policy-repository.ts";
import type { AccountRepository } from "./account-repository.ts";
import type { AccountingDimensionMemberRepository } from "./accounting-dimension-member-repository.ts";
import type { AccountingDimensionTypeRepository } from "./accounting-dimension-type-repository.ts";

export interface AccountingUnitOfWorkRepositories {
  readonly accounts: AccountRepository;
  readonly codingSettings: AccountCodingSettingsRepository;
  /** Implemented by the Phase 11 SQLite adapter in step 11.9. */
  readonly dimensionTypes?: AccountingDimensionTypeRepository;
  /** Implemented by the Phase 11 SQLite adapter in step 11.9. */
  readonly dimensionMembers?: AccountingDimensionMemberRepository;
  /** Implemented by the Phase 11 SQLite adapter in step 11.9. */
  readonly dimensionPolicies?: AccountDimensionPolicyRepository;
}

export interface AccountingUnitOfWork {
  run<T>(
    operation: (
      repositories: AccountingUnitOfWorkRepositories,
    ) => Promise<T>,
  ): Promise<T>;
}
