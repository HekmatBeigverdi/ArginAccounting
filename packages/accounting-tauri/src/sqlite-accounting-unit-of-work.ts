import type {
  AccountingUnitOfWork,
  AccountingUnitOfWorkRepositories,
} from "@argin/accounting";
import type { DatabaseExecutor } from "@argin/database";
import { SqliteAccountCodingSettingsRepository } from "./repositories/sqlite-account-coding-settings-repository.ts";
import { SqliteAccountRepository } from "./repositories/sqlite-account-repository.ts";

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
      })
    );
  }
}
