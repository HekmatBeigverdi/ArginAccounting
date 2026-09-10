import type { DatabaseExecutor, DatabaseSession } from "@argin/database";
import type { InventoryUnitOfWork, InventoryUnitOfWorkContext } from "@argin/inventory";
import {
  SqliteInventoryBalanceProjectionRepository,
  SqliteInventoryBusinessOrderRepository,
  SqliteInventoryDocumentRepository,
  SqliteInventoryIdempotencyRepository,
  SqliteInventoryMovementRepository,
} from "./sqlite-inventory-repositories.ts";
import { SqliteInventoryOpeningBalanceRepository } from "./sqlite-inventory-opening-repository.ts";

const contextFor = (database: DatabaseSession): InventoryUnitOfWorkContext => Object.freeze({
  documents: new SqliteInventoryDocumentRepository(database),
  movements: new SqliteInventoryMovementRepository(database),
  balances: new SqliteInventoryBalanceProjectionRepository(database),
  openings: new SqliteInventoryOpeningBalanceRepository(database),
  businessOrders: new SqliteInventoryBusinessOrderRepository(database),
  idempotency: new SqliteInventoryIdempotencyRepository(database),
});

/**
 * Inventory requires a DatabaseExecutor whose production transaction() pins one SQLite
 * connection and performs BEGIN IMMEDIATE/COMMIT/ROLLBACK. @argin/database-tauri provides
 * that guarantee for desktop connections as of Phase 20 Step 13.
 */
export class SqliteInventoryUnitOfWork implements InventoryUnitOfWork {
  private readonly sessions = new WeakMap<InventoryUnitOfWorkContext, DatabaseSession>();

  constructor(private readonly database: DatabaseExecutor) {}

  /** Share the active transaction with other SQLite repositories without nesting transactions. */
  sessionFor(context: InventoryUnitOfWorkContext): DatabaseSession {
    const session = this.sessions.get(context);
    if (!session) throw new Error("Inventory transaction context is not active.");
    return session;
  }

  execute<T>(work: (context: InventoryUnitOfWorkContext) => Promise<T>): Promise<T> {
    return this.database.transaction(async (transaction) => {
      const context = contextFor(transaction);
      this.sessions.set(context, transaction);
      try {
        return await work(context);
      } finally {
        this.sessions.delete(context);
      }
    });
  }
}
