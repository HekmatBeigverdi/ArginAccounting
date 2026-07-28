import type {
  DatabaseExecutor,
  DatabaseSession,
} from "../contracts/database-executor";
import type {
  UnitOfWork,
} from "./unit-of-work";

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
