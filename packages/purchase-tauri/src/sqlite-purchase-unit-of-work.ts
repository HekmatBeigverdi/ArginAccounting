import type { DatabaseExecutor, DatabaseSession } from "@argin/database";
import type { PurchaseUnitOfWork, PurchaseUnitOfWorkContext } from "@argin/purchase";
import {
  SqlitePurchaseCommercialFactRepository,
  SqlitePurchaseDocumentRepository,
  SqlitePurchaseReceiptInvoiceMatchRepository,
  SqlitePurchaseValuationCostInputRepository,
} from "./sqlite-purchase-repositories.ts";

const contextFor = (database: DatabaseSession): PurchaseUnitOfWorkContext => Object.freeze({
  documents: new SqlitePurchaseDocumentRepository(database),
  commercialFacts: new SqlitePurchaseCommercialFactRepository(database),
  matches: new SqlitePurchaseReceiptInvoiceMatchRepository(database),
  costInputs: new SqlitePurchaseValuationCostInputRepository(database),
});

/**
 * Purchase uses the same production transaction guarantee as Inventory:
 * one pinned SQLite connection with BEGIN IMMEDIATE / COMMIT / ROLLBACK
 * supplied by @argin/database-tauri.
 */
export class SqlitePurchaseUnitOfWork implements PurchaseUnitOfWork {
  private readonly sessions = new WeakMap<PurchaseUnitOfWorkContext, DatabaseSession>();

  constructor(private readonly database: DatabaseExecutor) {}

  sessionFor(context: PurchaseUnitOfWorkContext): DatabaseSession {
    const session = this.sessions.get(context);
    if (!session) throw new Error("Purchase transaction context is not active.");
    return session;
  }

  execute<T>(work: (context: PurchaseUnitOfWorkContext) => Promise<T>): Promise<T> {
    return this.database.transaction(async transaction => {
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
