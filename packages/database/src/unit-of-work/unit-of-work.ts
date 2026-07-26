import type {
  DatabaseSession,
} from "../contracts/database-executor";

export interface UnitOfWork {
  run<T>(
    operation: (
      session: DatabaseSession,
    ) => Promise<T>,
  ): Promise<T>;
}
