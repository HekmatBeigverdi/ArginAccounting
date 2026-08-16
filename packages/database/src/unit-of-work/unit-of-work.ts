import type {
  DatabaseSession,
} from "../contracts/database-executor.ts";

export interface UnitOfWork {
  run<T>(
    operation: (
      session: DatabaseSession,
    ) => Promise<T>,
  ): Promise<T>;
}
