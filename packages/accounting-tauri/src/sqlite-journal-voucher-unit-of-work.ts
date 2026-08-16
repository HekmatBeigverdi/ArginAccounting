import type {
  JournalVoucherUnitOfWork,
  JournalVoucherUnitOfWorkRepositories,
} from "@argin/accounting/journal";
import type { DatabaseExecutor } from "@argin/database";
import { SqliteJournalVoucherRepository } from "./repositories/sqlite-journal-voucher-repository.ts";

export class SqliteJournalVoucherUnitOfWork implements JournalVoucherUnitOfWork {
  constructor(private readonly database: DatabaseExecutor) {}

  run<T>(
    operation: (
      repositories: JournalVoucherUnitOfWorkRepositories,
    ) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction((session) =>
      operation({
        journals: new SqliteJournalVoucherRepository(session),
      })
    );
  }
}
