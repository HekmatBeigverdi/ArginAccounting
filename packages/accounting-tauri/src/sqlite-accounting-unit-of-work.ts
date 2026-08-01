import type {
  AccountingUnitOfWork,
  AccountingUnitOfWorkRepositories,
} from "@argin/accounting";
import type { DatabaseExecutor } from "@argin/database";
import { SqliteAccountCodingSettingsRepository } from "./repositories/sqlite-account-coding-settings-repository.ts";
import { SqliteAccountRepository } from "./repositories/sqlite-account-repository.ts";
import { SqliteAccountingDimensionTypeRepository } from "./repositories/sqlite-accounting-dimension-type-repository.ts";
import { SqliteAccountingDimensionMemberRepository } from "./repositories/sqlite-accounting-dimension-member-repository.ts";
import { SqliteAccountDimensionPolicyRepository } from "./repositories/sqlite-account-dimension-policy-repository.ts";

export class SqliteAccountingUnitOfWork implements AccountingUnitOfWork {
  constructor(private readonly database: DatabaseExecutor) {}

  run<T>(
    operation: (
      repositories: AccountingUnitOfWorkRepositories,
    ) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction((session) =>
      operation({
        accounts: new SqliteAccountRepository(session),
        codingSettings:
          new SqliteAccountCodingSettingsRepository(session),
        dimensionTypes: new SqliteAccountingDimensionTypeRepository(session),
        dimensionMembers: new SqliteAccountingDimensionMemberRepository(session),
        dimensionPolicies: new SqliteAccountDimensionPolicyRepository(session),
      })
    );
  }
}
