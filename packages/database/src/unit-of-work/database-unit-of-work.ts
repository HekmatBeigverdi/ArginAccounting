import type {
  DatabaseExecutor,
  DatabaseSession,
} from "../contracts/database-executor.ts";
import type {
  UnitOfWork,
} from "./unit-of-work.ts";

export class DatabaseUnitOfWork
  implements UnitOfWork {
  constructor(
    private readonly database:
      DatabaseExecutor,
  ) {}

  run<T>(
    operation: (
      session: DatabaseSession,
    ) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(operation);
  }
}
