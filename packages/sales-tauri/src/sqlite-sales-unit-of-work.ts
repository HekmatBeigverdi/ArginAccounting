import type { DatabaseExecutor } from "@argin/database";
import type { SalesUnitOfWork, SalesUnitOfWorkContext } from "@argin/sales";
import { SqliteSalesDocumentRepository, SqliteSalesIdempotencyRepository } from "./sqlite-sales-repositories.ts";

const contextFor=(db:Parameters<DatabaseExecutor["transaction"]>[0] extends (x:infer S)=>unknown?S:never):SalesUnitOfWorkContext=>Object.freeze({
  documents:new SqliteSalesDocumentRepository(db),
  idempotency:new SqliteSalesIdempotencyRepository(db),
});

/**
 * One pinned SQLite transaction supplied by @argin/database-tauri.
 * Production transaction() uses BEGIN IMMEDIATE / COMMIT / ROLLBACK.
 */
export class SqliteSalesUnitOfWork implements SalesUnitOfWork {
  constructor(private readonly database:DatabaseExecutor){}
  execute<T>(work:(context:SalesUnitOfWorkContext)=>Promise<T>):Promise<T>{
    return this.database.transaction(async session=>work(contextFor(session)));
  }
}
