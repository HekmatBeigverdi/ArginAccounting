import type {
  DatabaseExecuteResult,
} from "./database-execute-result.ts";
import type {
  DatabaseValue,
} from "./database-value.ts";

export interface DatabaseSession {
  execute(
    sql: string,
    parameters?: readonly DatabaseValue[],
  ): Promise<DatabaseExecuteResult>;

  query<T>(
    sql: string,
    parameters?: readonly DatabaseValue[],
  ): Promise<T[]>;

  queryOne<T>(
    sql: string,
    parameters?: readonly DatabaseValue[],
  ): Promise<T | null>;
}

export interface DatabaseExecutor
  extends DatabaseSession {
  transaction<T>(
    operation: (
      transaction: DatabaseSession,
    ) => Promise<T>,
  ): Promise<T>;

  close(): Promise<void>;
}
