import type { DatabaseExecutor, DatabaseSession } from "@argin/database";
import type { InventoryUnitOfWork, InventoryUnitOfWorkContext } from "@argin/inventory";
import {
  SqliteInventoryBalanceProjectionRepository,
  SqliteInventoryBusinessOrderRepository,
  SqliteInventoryDocumentRepository,
  SqliteInventoryIdempotencyRepository,
  SqliteInventoryMovementRepository,
  SqliteInventoryOpeningBalanceRepository,
} from "./sqlite-inventory-repositories.ts";

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
  constructor(private readonly database: DatabaseExecutor) {}

  execute<T>(work: (context: InventoryUnitOfWorkContext) => Promise<T>): Promise<T> {
    return this.database.transaction(async (transaction) => work(contextFor(transaction)));
  }
}
