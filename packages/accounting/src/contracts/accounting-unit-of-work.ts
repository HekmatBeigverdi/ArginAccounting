import type { AccountCodingSettingsRepository } from "./account-coding-settings-repository.ts";
import type { AccountRepository } from "./account-repository.ts";

export interface AccountingUnitOfWorkRepositories {
  readonly accounts: AccountRepository;
  readonly codingSettings: AccountCodingSettingsRepository;
}

export interface AccountingUnitOfWork {
  run<T>(
    operation: (
      repositories: AccountingUnitOfWorkRepositories,
    ) => Promise<T>,
  ): Promise<T>;
}
