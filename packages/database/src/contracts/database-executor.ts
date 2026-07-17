import type { DatabaseExecuteResult } from "./database-execute-result";
import type { DatabaseValue } from "./database-value";

export interface DatabaseExecutor {
  execute(
    sql: string,
    parameters?: readonly DatabaseValue[]
  ): Promise<DatabaseExecuteResult>;

  query<T>(
    sql: string,
    parameters?: readonly DatabaseValue[]
  ): Promise<T[]>;

  queryOne<T>(
    sql: string,
    parameters?: readonly DatabaseValue[]
  ): Promise<T | null>;

  transaction<T>(
    operation: (transaction: DatabaseExecutor) => Promise<T>
  ): Promise<T>;

  close(): Promise<void>;
}
